/**
 * File-based data store for VPS monitoring metrics.
 * Uses JSON file for persistence across Next.js worker processes.
 */

import fs from 'fs';
import path from 'path';

export interface ServerInfo {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  kernel: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number; // bytes
  totalDisk: number; // bytes
  agentVersion: string;
  firstSeen: number; // timestamp ms
  lastSeen: number; // timestamp ms
  remark?: string; // 备注
  // 流量限制配置
  trafficLimitGB?: number; // 月流量上限 (GB)，0 或 undefined 表示不限制
  trafficMode?: 'down' | 'both'; // 'down' 只算下行，'both' 算上下行
  trafficResetDay?: number; // 每月重置日期 (1-28)，默认 1
  trafficPeriodStart?: number; // 当前计费周期开始时间 (timestamp ms)
  trafficBaselineRx?: number; // 周期开始时的 agent totalRx (baseline for delta)
  trafficBaselineTx?: number; // 周期开始时的 agent totalTx (baseline for delta)
  trafficPeriodRx?: number; // 当前周期累计下行 (bytes)
  trafficPeriodTx?: number; // 当前周期累计上行 (bytes)
}

export interface MetricsRecord {
  timestamp: number; // ms
  cpuUsage: number; // 0-100
  memoryUsed: number; // bytes
  memoryUsage: number; // 0-100
  diskUsed: number; // bytes
  diskUsage: number; // 0-100
  networkRxBytes: number; // bytes/s (real-time speed)
  networkTxBytes: number; // bytes/s (real-time speed)
  totalRxBytes: number; // cumulative bytes received
  totalTxBytes: number; // cumulative bytes transmitted
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  uptime: number; // seconds
}

export interface ServerData {
  info: ServerInfo;
  metrics: MetricsRecord[];
  latest: MetricsRecord | null;
}

// Max records to keep per server (about 24h at 5s interval)
const MAX_RECORDS = 17280;

// File path for persistent storage
const DATA_DIR = process.env.COZE_WORKSPACE_PATH || '/workspace/projects';
const STORE_FILE = path.join(DATA_DIR, '.vps-data.json');

// Shared secret for agent authentication (set via env)
const AGENT_SECRET = process.env.AGENT_SECRET || 'vps-monitor-default-secret';

// In-memory cache with file sync
let servers = new Map<string, ServerData>();
let saveTimeout: NodeJS.Timeout | null = null;

/**
 * Load data from file into memory
 */
function loadFromDisk(): void {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      servers = new Map(Object.entries(data));
    }
  } catch (err) {
    console.error('Failed to load store from disk:', err);
    servers = new Map();
  }
}

/**
 * Save data from memory to file (debounced)
 */
function saveToDisk(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj = Object.fromEntries(servers);
      fs.writeFileSync(STORE_FILE, JSON.stringify(obj), 'utf-8');
    } catch (err) {
      console.error('Failed to save store to disk:', err);
    }
  }, 500); // Debounce 500ms
}

// Load data on module init
loadFromDisk();

export function getAgentSecret(): string {
  return AGENT_SECRET;
}

export function getAllServers(): ServerData[] {
  // Reload from disk to get latest data from other workers
  loadFromDisk();
  return Array.from(servers.values());
}

export function getServer(id: string): ServerData | undefined {
  loadFromDisk();
  return servers.get(id);
}

export function upsertServer(info: ServerInfo, metrics: MetricsRecord): ServerData {
  // Reload to get latest state
  loadFromDisk();

  let data = servers.get(info.id);

  if (!data) {
    data = {
      info: { ...info, firstSeen: Date.now(), lastSeen: Date.now() },
      metrics: [],
      latest: null,
    };
    servers.set(info.id, data);
  } else {
    data.info = { ...data.info, ...info, lastSeen: Date.now() };
  }

  data.metrics.push(metrics);
  data.latest = metrics;

  // Update cumulative traffic
  updateTraffic(info.id, metrics.totalRxBytes, metrics.totalTxBytes);

  // Trim old records
  if (data.metrics.length > MAX_RECORDS) {
    data.metrics = data.metrics.slice(-MAX_RECORDS);
  }

  // Save to disk
  saveToDisk();

  return data;
}

export function getMetricsHistory(
  serverId: string,
  limit: number = 60
): MetricsRecord[] {
  const data = servers.get(serverId);
  if (!data) return [];
  return data.metrics.slice(-limit);
}

export function removeServer(id: string): boolean {
  loadFromDisk();
  const result = servers.delete(id);
  saveToDisk();
  return result;
}

export function updateServerRemark(id: string, remark: string): boolean {
  loadFromDisk();
  const data = servers.get(id);
  if (!data) return false;
  data.info.remark = remark;
  saveToDisk();
  return true;
}

export interface TrafficSettings {
  trafficLimitGB?: number;
  trafficMode?: 'down' | 'both';
  trafficResetDay?: number;
}

export function updateTrafficSettings(id: string, settings: TrafficSettings): boolean {
  loadFromDisk();
  const data = servers.get(id);
  if (!data) return false;
  
  if (settings.trafficLimitGB !== undefined) {
    data.info.trafficLimitGB = settings.trafficLimitGB;
  }
  if (settings.trafficMode !== undefined) {
    data.info.trafficMode = settings.trafficMode;
  }
  if (settings.trafficResetDay !== undefined) {
    data.info.trafficResetDay = settings.trafficResetDay;
  }
  
  // Initialize period tracking if not set
  if (!data.info.trafficPeriodStart) {
    data.info.trafficPeriodStart = Date.now();
    data.info.trafficPeriodRx = 0;
    data.info.trafficPeriodTx = 0;
  }
  
  saveToDisk();
  return true;
}

/**
 * Get traffic usage for a server
 * Returns: { usedBytes, limitBytes, percentage, status }
 * status: 'normal' | 'warning' (80%) | 'danger' (100%) | 'unlimited'
 */
export function getTrafficUsage(id: string): {
  usedBytes: number;
  limitBytes: number;
  percentage: number;
  status: 'normal' | 'warning' | 'danger' | 'unlimited';
  rxBytes: number;
  txBytes: number;
} {
  loadFromDisk();
  const data = servers.get(id);
  if (!data || !data.info.trafficLimitGB || data.info.trafficLimitGB <= 0) {
    return { usedBytes: 0, limitBytes: 0, percentage: 0, status: 'unlimited', rxBytes: 0, txBytes: 0 };
  }
  
  const limitBytes = data.info.trafficLimitGB * 1024 * 1024 * 1024;
  const rxBytes = data.info.trafficPeriodRx || 0;
  const txBytes = data.info.trafficPeriodTx || 0;
  
  // Calculate used bytes based on traffic mode
  const usedBytes = data.info.trafficMode === 'down' ? rxBytes : rxBytes + txBytes;
  
  const percentage = (usedBytes / limitBytes) * 100;
  
  let status: 'normal' | 'warning' | 'danger' = 'normal';
  if (percentage >= 100) {
    status = 'danger';
  } else if (percentage >= 80) {
    status = 'warning';
  }
  
  return { usedBytes, limitBytes, percentage, status, rxBytes, txBytes };
}

/**
 * Update cumulative traffic for a server
 * Called when agent reports new metrics
 * 
 * Agent reports totalRx/totalTx as absolute values since system boot.
 * We need to track the delta within the current billing period.
 * Strategy: store a baseline (first seen values in this period) and
 * compute period usage as (current - baseline).
 */
export function updateTraffic(id: string, totalRx: number, totalTx: number): void {
  const data = servers.get(id);
  if (!data) return;
  
  // We store baseline values to compute deltas
  // trafficBaselineRx/Tx: the agent's totalRx/Tx at period start
  // trafficPeriodRx/Tx: the computed usage within this period (delta)
  const info = data.info;
  
  // Initialize period tracking if not set
  if (!info.trafficPeriodStart) {
    info.trafficPeriodStart = Date.now();
    info.trafficBaselineRx = totalRx;
    info.trafficBaselineTx = totalTx;
    info.trafficPeriodRx = 0;
    info.trafficPeriodTx = 0;
  }
  
  // Check if we need to reset the period (monthly reset)
  const now = new Date();
  const periodStart = new Date(info.trafficPeriodStart);
  const resetDay = info.trafficResetDay || 1;
  
  // Check if current month's reset day has passed since last period start
  const currentResetDate = new Date(now.getFullYear(), now.getMonth(), resetDay);
  if (currentResetDate > periodStart && now >= currentResetDate) {
    // Reset the period - current values become new baseline
    info.trafficPeriodStart = currentResetDate.getTime();
    info.trafficBaselineRx = totalRx;
    info.trafficBaselineTx = totalTx;
    info.trafficPeriodRx = 0;
    info.trafficPeriodTx = 0;
    return;
  }
  
  // Compute delta from baseline
  // Handle server reboot: if current < baseline, values reset, use current as new baseline
  const baselineRx = info.trafficBaselineRx || 0;
  const baselineTx = info.trafficBaselineTx || 0;
  
  if (totalRx < baselineRx || totalTx < baselineTx) {
    // Server rebooted, agent values reset - use current as new baseline
    info.trafficBaselineRx = totalRx;
    info.trafficBaselineTx = totalTx;
    info.trafficPeriodRx = 0;
    info.trafficPeriodTx = 0;
  } else {
    info.trafficPeriodRx = totalRx - baselineRx;
    info.trafficPeriodTx = totalTx - baselineTx;
  }
}

/**
 * Check if a server is considered offline (no report for 2 minutes)
 */
export function isServerOnline(data: ServerData): boolean {
  return Date.now() - data.info.lastSeen < 120_000;
}

/**
 * Demo data seeding disabled - start with empty server list
 */
export function seedDemoData(): void {
  // No demo data - start clean
  return;
}
