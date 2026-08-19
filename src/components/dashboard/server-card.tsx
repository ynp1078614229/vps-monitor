'use client';

import { StatusIndicator } from './status-indicator';

interface ServerCardProps {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  cpuCores: number;
  totalMemory: number;
  online: boolean;
  lastSeen: number;
  latest: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkRxBytes: number;
    networkTxBytes: number;
    loadAvg1: number;
  } | null;
  onClick: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function getUsageColor(usage: number): string {
  if (usage >= 90) return 'text-[var(--status-critical)]';
  if (usage >= 70) return 'text-[var(--status-offline)]';
  if (usage >= 50) return 'text-[var(--status-warning)]';
  return 'text-[var(--status-online)]';
}

function getUsageBgColor(usage: number): string {
  if (usage >= 90) return 'bg-[var(--status-critical)]';
  if (usage >= 70) return 'bg-[var(--status-offline)]';
  if (usage >= 50) return 'bg-[var(--status-warning)]';
  return 'bg-[var(--status-online)]';
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ServerCard({
  hostname,
  ip,
  os,
  cpuCores,
  totalMemory,
  online,
  lastSeen,
  latest,
  onClick,
}: ServerCardProps) {
  return (
    <div
      onClick={onClick}
      className="card-hover bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 cursor-pointer transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusIndicator online={online} />
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              {hostname}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">
              {ip}
            </p>
          </div>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {online ? 'Online' : timeAgo(lastSeen)}
        </span>
      </div>

      {/* System Info */}
      <div className="flex gap-4 mb-4 text-xs text-[var(--muted-foreground)]">
        <span>{os}</span>
        <span>{cpuCores} cores</span>
        <span>{formatBytes(totalMemory)}</span>
      </div>

      {/* Metrics */}
      {online && latest ? (
        <div className="space-y-3">
          {/* CPU */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[var(--muted-foreground)]">CPU</span>
              <span className={`metric-value text-sm ${getUsageColor(latest.cpuUsage)}`}>
                {latest.cpuUsage.toFixed(1)}
                <span className="metric-unit">%</span>
              </span>
            </div>
            <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getUsageBgColor(latest.cpuUsage)}`}
                style={{ width: `${Math.min(100, latest.cpuUsage)}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[var(--muted-foreground)]">Memory</span>
              <span className={`metric-value text-sm ${getUsageColor(latest.memoryUsage)}`}>
                {latest.memoryUsage.toFixed(1)}
                <span className="metric-unit">%</span>
              </span>
            </div>
            <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getUsageBgColor(latest.memoryUsage)}`}
                style={{ width: `${Math.min(100, latest.memoryUsage)}%` }}
              />
            </div>
          </div>

          {/* Network */}
          <div className="flex gap-4 pt-2 border-t border-[var(--border)]">
            <div className="flex-1">
              <span className="text-xs text-[var(--muted-foreground)]">↓ RX</span>
              <p className="metric-value text-xs text-[var(--chart-1)]">
                {formatSpeed(latest.networkRxBytes)}
              </p>
            </div>
            <div className="flex-1">
              <span className="text-xs text-[var(--muted-foreground)]">↑ TX</span>
              <p className="metric-value text-xs text-[var(--chart-4)]">
                {formatSpeed(latest.networkTxBytes)}
              </p>
            </div>
            <div className="flex-1">
              <span className="text-xs text-[var(--muted-foreground)]">Load</span>
              <p className="metric-value text-xs text-[var(--foreground)]">
                {latest.loadAvg1.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-[var(--muted-foreground)]">
          No metrics available
        </div>
      )}
    </div>
  );
}
