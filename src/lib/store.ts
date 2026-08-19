/**
 * In-memory data store for VPS monitoring metrics.
 * In production, replace with a persistent database (e.g., PostgreSQL with Drizzle ORM).
 */

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
}

export interface MetricsRecord {
  timestamp: number; // ms
  cpuUsage: number; // 0-100
  memoryUsed: number; // bytes
  memoryUsage: number; // 0-100
  diskUsed: number; // bytes
  diskUsage: number; // 0-100
  networkRxBytes: number; // bytes/s
  networkTxBytes: number; // bytes/s
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

// Max records to keep per server (about 24h at 30s interval)
const MAX_RECORDS = 2880;

// Store: serverId -> ServerData
const servers = new Map<string, ServerData>();

// Shared secret for agent authentication (set via env)
const AGENT_SECRET = process.env.AGENT_SECRET || 'vps-monitor-default-secret';

export function getAgentSecret(): string {
  return AGENT_SECRET;
}

export function getAllServers(): ServerData[] {
  return Array.from(servers.values());
}

export function getServer(id: string): ServerData | undefined {
  return servers.get(id);
}

export function upsertServer(info: ServerInfo, metrics: MetricsRecord): ServerData {
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

  // Trim old records
  if (data.metrics.length > MAX_RECORDS) {
    data.metrics = data.metrics.slice(-MAX_RECORDS);
  }

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
  return servers.delete(id);
}

/**
 * Check if a server is considered offline (no report for 2 minutes)
 */
export function isServerOnline(data: ServerData): boolean {
  return Date.now() - data.info.lastSeen < 120_000;
}

/**
 * Seed demo data for preview purposes
 */
export function seedDemoData(): void {
  if (servers.size > 0) return;

  const demoServers: Array<{
    id: string;
    hostname: string;
    ip: string;
    os: string;
    cpuModel: string;
    cpuCores: number;
    totalMemory: number;
    totalDisk: number;
  }> = [
    {
      id: 'demo-us-east-1',
      hostname: 'us-east-prod-01',
      ip: '10.0.1.10',
      os: 'Ubuntu 22.04 LTS',
      cpuModel: 'Intel Xeon E5-2686 v4',
      cpuCores: 4,
      totalMemory: 8 * 1024 * 1024 * 1024,
      totalDisk: 100 * 1024 * 1024 * 1024,
    },
    {
      id: 'demo-eu-west-1',
      hostname: 'eu-west-prod-02',
      ip: '10.0.2.20',
      os: 'Debian 12',
      cpuModel: 'AMD EPYC 7R13',
      cpuCores: 8,
      totalMemory: 16 * 1024 * 1024 * 1024,
      totalDisk: 200 * 1024 * 1024 * 1024,
    },
    {
      id: 'demo-ap-south-1',
      hostname: 'ap-south-staging-01',
      ip: '10.0.3.30',
      os: 'Ubuntu 24.04 LTS',
      cpuModel: 'Intel Xeon Platinum 8375C',
      cpuCores: 2,
      totalMemory: 4 * 1024 * 1024 * 1024,
      totalDisk: 50 * 1024 * 1024 * 1024,
    },
  ];

  const now = Date.now();

  for (const s of demoServers) {
    const metrics: MetricsRecord[] = [];
    const baseCpu = 15 + Math.random() * 30;
    const baseMem = 30 + Math.random() * 25;

    for (let i = 59; i >= 0; i--) {
      const t = now - i * 30_000;
      const cpuJitter = Math.sin(i * 0.3) * 10 + (Math.random() - 0.5) * 8;
      const memJitter = Math.sin(i * 0.1) * 5 + (Math.random() - 0.5) * 3;

      metrics.push({
        timestamp: t,
        cpuUsage: Math.max(0, Math.min(100, baseCpu + cpuJitter)),
        memoryUsed: ((baseMem + memJitter) / 100) * s.totalMemory,
        memoryUsage: Math.max(0, Math.min(100, baseMem + memJitter)),
        diskUsed: (20 + Math.random() * 10) / 100 * s.totalDisk,
        diskUsage: 20 + Math.random() * 10,
        networkRxBytes: 500_000 + Math.random() * 2_000_000,
        networkTxBytes: 200_000 + Math.random() * 1_000_000,
        loadAvg1: 0.5 + Math.random() * 2,
        loadAvg5: 0.4 + Math.random() * 1.5,
        loadAvg15: 0.3 + Math.random() * 1,
        uptime: 86400 * (30 + Math.floor(Math.random() * 60)),
      });
    }

    const info: ServerInfo = {
      ...s,
      kernel: '5.15.0-generic',
      agentVersion: '1.0.0',
      firstSeen: now - 86400_000 * 30,
      lastSeen: now,
    };

    servers.set(s.id, {
      info,
      metrics,
      latest: metrics[metrics.length - 1],
    });
  }
}
