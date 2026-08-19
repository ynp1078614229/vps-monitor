'use client';

import { useState, useEffect, useCallback } from 'react';
import { MetricsChart, NetworkChart } from './metrics-chart';
import { StatusIndicator } from './status-indicator';
import { ArrowLeft, Cpu, HardDrive, MemoryStick, Clock, Server } from 'lucide-react';

interface ServerDetailProps {
  serverId: string;
  onBack: () => void;
}

interface ServerInfo {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  kernel: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number;
  totalDisk: number;
  agentVersion: string;
  firstSeen: number;
  lastSeen: number;
  online: boolean;
}

interface MetricsRecord {
  timestamp: number;
  cpuUsage: number;
  memoryUsed: number;
  memoryUsage: number;
  diskUsed: number;
  diskUsage: number;
  networkRxBytes: number;
  networkTxBytes: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  uptime: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function ServerDetail({ serverId, onBack }: ServerDetailProps) {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [metrics, setMetrics] = useState<MetricsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${serverId}/metrics`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setServer(data.server);
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--muted-foreground)]">Server not found</div>
      </div>
    );
  }

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <StatusIndicator online={server.online} size="lg" />
          <div>
            <h2 className="text-lg font-semibold">{server.hostname}</h2>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">
              {server.ip}
            </p>
          </div>
        </div>
      </div>

      {/* System Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard
          icon={<Server className="w-4 h-4 text-[var(--chart-1)]" />}
          label="OS"
          value={server.os}
        />
        <InfoCard
          icon={<Cpu className="w-4 h-4 text-[var(--chart-2)]" />}
          label="CPU"
          value={`${server.cpuCores} cores`}
          sub={server.cpuModel}
        />
        <InfoCard
          icon={<MemoryStick className="w-4 h-4 text-[var(--chart-4)]" />}
          label="Memory"
          value={formatBytes(server.totalMemory)}
        />
        <InfoCard
          icon={<HardDrive className="w-4 h-4 text-[var(--chart-3)]" />}
          label="Disk"
          value={formatBytes(server.totalDisk)}
        />
      </div>

      {/* Current Metrics */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricBox
            label="CPU Usage"
            value={`${latest.cpuUsage.toFixed(1)}%`}
            color={getUsageColorVar(latest.cpuUsage)}
          />
          <MetricBox
            label="Memory"
            value={`${latest.memoryUsage.toFixed(1)}%`}
            color={getUsageColorVar(latest.memoryUsage)}
          />
          <MetricBox
            label="Disk"
            value={`${latest.diskUsage.toFixed(1)}%`}
            color={getUsageColorVar(latest.diskUsage)}
          />
          <MetricBox
            label="Load Avg"
            value={latest.loadAvg1.toFixed(2)}
            sub={`5m: ${latest.loadAvg5.toFixed(2)} / 15m: ${latest.loadAvg15.toFixed(2)}`}
          />
          <MetricBox
            label="Uptime"
            value={formatUptime(latest.uptime)}
            icon={<Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricsChart
          data={metrics}
          title="CPU Usage"
          dataKey="cpuUsage"
          color="#06b6d4"
          unit="%"
        />
        <MetricsChart
          data={metrics}
          title="Memory Usage"
          dataKey="memoryUsage"
          color="#8b5cf6"
          unit="%"
        />
      </div>

      <NetworkChart data={metrics} />
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className="text-sm font-semibold truncate">{value}</p>
      {sub && (
        <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}

function MetricBox({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        {icon}
      </div>
      <p className="metric-value text-xl" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && (
        <p className="text-xs text-[var(--muted-foreground)] mt-1 font-mono">
          {sub}
        </p>
      )}
    </div>
  );
}

function getUsageColorVar(usage: number): string {
  if (usage >= 90) return 'var(--status-critical)';
  if (usage >= 70) return 'var(--status-offline)';
  if (usage >= 50) return 'var(--status-warning)';
  return 'var(--status-online)';
}
