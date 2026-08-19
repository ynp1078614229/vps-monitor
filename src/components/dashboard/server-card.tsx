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
    totalRxBytes: number;
    totalTxBytes: number;
    loadAvg1: number;
  } | null;
  onClick: () => void;
}

function formatKB(bytesPerSec: number): string {
  const kb = bytesPerSec / 1024;
  if (kb < 1) return `${(bytesPerSec).toFixed(0)} B`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(1)} KB`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export function ServerCard({
  hostname,
  ip,
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
      {/* Header: 名称 + 状态 */}
      <div className="flex items-center justify-between mb-4">
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
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          online
            ? 'bg-green-50 text-[var(--status-online)]'
            : 'bg-red-50 text-[var(--status-offline)]'
        }`}>
          {online ? '在线' : '离线'}
        </span>
      </div>

      {/* Metrics */}
      {online && latest ? (
        <div className="space-y-3">
          {/* CPU */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
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
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-[var(--muted-foreground)]">内存</span>
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

          {/* Network - Real-time + Cumulative */}
          <div className="pt-3 border-t border-[var(--border)] space-y-2">
            {/* Real-time speed */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--chart-4)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--chart-4)]" />
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">上传</span>
                </div>
                <p className="metric-value text-sm text-[var(--chart-4)]">
                  {formatKB(latest.networkTxBytes)}<span className="metric-unit">/s</span>
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--chart-1)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--chart-1)]" />
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">下载</span>
                </div>
                <p className="metric-value text-sm text-[var(--chart-1)]">
                  {formatKB(latest.networkRxBytes)}<span className="metric-unit">/s</span>
                </p>
              </div>
            </div>
            {/* Cumulative traffic */}
            <div className="flex gap-4 pt-2 border-t border-dashed border-[var(--border)]">
              <div className="flex-1">
                <span className="text-xs text-[var(--muted-foreground)]">累计上传</span>
                <p className="metric-value text-xs text-[var(--foreground)]">
                  {formatBytes(latest.totalTxBytes)}
                </p>
              </div>
              <div className="flex-1">
                <span className="text-xs text-[var(--muted-foreground)]">累计下载</span>
                <p className="metric-value text-xs text-[var(--foreground)]">
                  {formatBytes(latest.totalRxBytes)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-sm text-[var(--muted-foreground)]">
          {online ? '暂无数据' : `最后上报: ${timeAgo(lastSeen)}`}
        </div>
      )}
    </div>
  );
}
