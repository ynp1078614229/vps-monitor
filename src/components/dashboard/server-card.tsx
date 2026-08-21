'use client';

import { useState } from 'react';
import { StatusIndicator } from './status-indicator';
import { Trash2, Pencil, Check, X, Settings } from 'lucide-react';

interface ServerCardProps {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  cpuCores: number;
  totalMemory: number;
  online: boolean;
  lastSeen: number;
  remark?: string;
  latency?: number | null;
  trafficLimitGB?: number | null;
  trafficMode?: 'down' | 'both';
  trafficResetDay?: number;
  trafficPeriodRx?: number;
  trafficPeriodTx?: number;
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
  onDelete: () => void;
  onRemarkUpdate?: (id: string, remark: string) => void;
  onTrafficSettings?: (id: string) => void;
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
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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

// Calculate traffic usage percentage and status
function getTrafficStatus(
  totalRxBytes: number,
  totalTxBytes: number,
  trafficLimitGB: number | null | undefined,
  trafficMode: 'down' | 'both' | undefined
): { percentage: number; status: 'normal' | 'warning' | 'danger' } {
  if (!trafficLimitGB || trafficLimitGB <= 0) {
    return { percentage: 0, status: 'normal' };
  }
  
  const usedBytes = trafficMode === 'down' 
    ? totalRxBytes 
    : totalRxBytes + totalTxBytes;
  
  const limitBytes = trafficLimitGB * 1024 * 1024 * 1024;
  const percentage = (usedBytes / limitBytes) * 100;
  
  if (percentage >= 100) {
    return { percentage, status: 'danger' };
  } else if (percentage >= 80) {
    return { percentage, status: 'warning' };
  }
  return { percentage, status: 'normal' };
}

export function ServerCard({
  id,
  hostname,
  ip,
  online,
  lastSeen,
  remark,
  latency,
  trafficLimitGB,
  trafficMode,
  trafficResetDay,
  trafficPeriodRx,
  trafficPeriodTx,
  latest,
  onClick,
  onDelete,
  onRemarkUpdate,
  onTrafficSettings,
}: ServerCardProps) {
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [editRemarkValue, setEditRemarkValue] = useState(remark || '');

  // Calculate traffic status using period-based values (from store)
  // Fall back to absolute totalRx/totalTx if period values not available
  const usedRx = trafficPeriodRx && trafficPeriodRx > 0 ? trafficPeriodRx : (latest?.totalRxBytes || 0);
  const usedTx = trafficPeriodTx && trafficPeriodTx > 0 ? trafficPeriodTx : (latest?.totalTxBytes || 0);
  
  const trafficStatus = getTrafficStatus(
    usedRx,
    usedTx,
    trafficLimitGB,
    trafficMode
  );

  // Determine card border color based on traffic status
  const getTrafficBorderColor = () => {
    if (trafficStatus.status === 'danger') return 'border-red-500 border-2';
    if (trafficStatus.status === 'warning') return 'border-yellow-500 border-2';
    return 'border-[var(--border)]';
  };

  // Determine card background based on traffic status
  const getTrafficBgColor = () => {
    if (trafficStatus.status === 'danger') return 'bg-red-50/30';
    if (trafficStatus.status === 'warning') return 'bg-yellow-50/30';
    return 'bg-[var(--card)]';
  };

  const handleSaveRemark = () => {
    if (onRemarkUpdate) {
      onRemarkUpdate(id, editRemarkValue);
    }
    setIsEditingRemark(false);
  };

  const handleCancelEdit = () => {
    setEditRemarkValue(remark || '');
    setIsEditingRemark(false);
  };

  return (
    <div
      onClick={onClick}
      className={`card-hover ${getTrafficBgColor()} ${getTrafficBorderColor()} rounded-lg p-3 cursor-pointer transition-all duration-200 relative group`}
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 p-1 text-[var(--muted-foreground)] hover:text-[var(--status-offline)] opacity-0 group-hover:opacity-100 transition-opacity"
        title="删除服务器"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Header: 名称 + 状态 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StatusIndicator online={online} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-[var(--foreground)] truncate">
              {hostname}
            </h3>
            <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
              {ip}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {online && latency !== null && latency !== undefined && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              latency < 50 ? 'bg-green-50 text-[var(--status-online)]' :
              latency < 100 ? 'bg-yellow-50 text-[var(--status-warning)]' :
              'bg-red-50 text-[var(--status-offline)]'
            }`}>
              {latency.toFixed(0)}ms
            </span>
          )}
          {online && (latency === null || latency === undefined) && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-50 text-[var(--muted-foreground)]">
              ...
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            online
              ? 'bg-green-50 text-[var(--status-online)]'
              : 'bg-red-50 text-[var(--status-offline)]'
          }`}>
            {online ? '在线' : '离线'}
          </span>
        </div>
      </div>

      {/* 备注 */}
      {isEditingRemark ? (
        <div className="flex items-center gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editRemarkValue}
            onChange={(e) => setEditRemarkValue(e.target.value)}
            className="text-[10px] border border-[var(--border)] rounded px-1 py-0.5 flex-1 min-w-0 bg-[var(--card)] text-[var(--foreground)]"
            placeholder="备注..."
            autoFocus
          />
          <button onClick={handleSaveRemark} className="p-0.5 text-[var(--status-online)]" title="保存">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={handleCancelEdit} className="p-0.5 text-[var(--muted-foreground)]" title="取消">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-2">
          {remark ? (
            <p className="text-[10px] text-[var(--muted-foreground)] italic truncate flex-1">
              {remark}
            </p>
          ) : (
            <p className="text-[10px] text-[var(--muted-foreground)]/50 italic flex-1">
              添加备注
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditRemarkValue(remark || '');
              setIsEditingRemark(true);
            }}
            className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity"
            title="编辑备注"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* Metrics - always show; offline shows 0 for real-time, keep traffic from history */}
      {latest ? (
        <div className="space-y-1.5">
          {/* CPU */}
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[10px] text-[var(--muted-foreground)]">CPU</span>
              <span className={`metric-value text-xs ${online ? getUsageColor(latest.cpuUsage) : 'text-[var(--muted-foreground)]'}`}>
                {online ? latest.cpuUsage.toFixed(1) : '0.0'}
                <span className="metric-unit">%</span>
              </span>
            </div>
            <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${online ? getUsageBgColor(latest.cpuUsage) : 'bg-[var(--muted)]'}`}
                style={{ width: `${online ? Math.min(100, latest.cpuUsage) : 0}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[10px] text-[var(--muted-foreground)]">内存</span>
              <span className={`metric-value text-xs ${online ? getUsageColor(latest.memoryUsage) : 'text-[var(--muted-foreground)]'}`}>
                {online ? latest.memoryUsage.toFixed(1) : '0.0'}
                <span className="metric-unit">%</span>
              </span>
            </div>
            <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${online ? getUsageBgColor(latest.memoryUsage) : 'bg-[var(--muted)]'}`}
                style={{ width: `${online ? Math.min(100, latest.memoryUsage) : 0}%` }}
              />
            </div>
          </div>

          {/* Network - Compact */}
          <div className="pt-1.5 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  {online && (
                    <span className="relative flex h-1 w-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--chart-4)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-[var(--chart-4)]" />
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--muted-foreground)]">↑</span>
                </div>
                <p className={`metric-value text-[10px] ${online ? 'text-[var(--chart-4)]' : 'text-[var(--muted-foreground)]'}`}>
                  {online ? <>{formatKB(latest.networkTxBytes)}<span className="metric-unit">/s</span></> : '0 B/s'}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  {online && (
                    <span className="relative flex h-1 w-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--chart-1)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1 w-1 bg-[var(--chart-1)]" />
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--muted-foreground)]">↓</span>
                </div>
                <p className={`metric-value text-[10px] ${online ? 'text-[var(--chart-1)]' : 'text-[var(--muted-foreground)]'}`}>
                  {online ? <>{formatKB(latest.networkRxBytes)}<span className="metric-unit">/s</span></> : '0 B/s'}
                </p>
              </div>
            </div>
            {/* Cumulative traffic */}
            <div className="flex gap-2 pt-1 mt-1 border-t border-dashed border-[var(--border)]">
              <div className="flex-1">
                <span className="text-[10px] text-[var(--muted-foreground)]">总↑</span>
                <p className="metric-value text-[10px] text-[var(--foreground)]">
                  {formatBytes(latest.totalTxBytes)}
                </p>
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-[var(--muted-foreground)]">总↓</span>
                <p className="metric-value text-[10px] text-[var(--foreground)]">
                  {formatBytes(latest.totalRxBytes)}
                </p>
              </div>
            </div>
            {/* Traffic limit with progress bar */}
            {trafficLimitGB && trafficLimitGB > 0 && (
              <div className={`pt-1 mt-1 border-t border-dashed border-[var(--border)]`}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    流量 {trafficMode === 'down' ? '(仅下行)' : '(上下行)'}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-medium ${
                      trafficStatus.status === 'danger' 
                        ? 'text-red-500' 
                        : trafficStatus.status === 'warning' 
                          ? 'text-yellow-600' 
                          : 'text-[var(--foreground)]'
                    }`}>
                      {formatBytes(trafficMode === 'both' ? usedRx + usedTx : usedRx)} / {trafficLimitGB}GB
                    </span>
                    {onTrafficSettings && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onTrafficSettings(id); }}
                        className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                        title="设置流量"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      trafficStatus.status === 'danger'
                        ? 'bg-red-500'
                        : trafficStatus.status === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-[var(--chart-1)]'
                    }`}
                    style={{ width: `${Math.min(100, trafficStatus.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className={`text-[10px] ${
                    trafficStatus.status === 'danger' 
                      ? 'text-red-500' 
                      : trafficStatus.status === 'warning' 
                        ? 'text-yellow-600' 
                        : 'text-[var(--muted-foreground)]'
                  }`}>
                    {trafficStatus.status === 'danger' ? '⚠️ 已超限' : trafficStatus.status === 'warning' ? '⚠️ 接近上限' : '剩余'}
                  </span>
                  <span className={`text-[10px] font-medium ${
                    trafficStatus.status === 'danger' 
                      ? 'text-red-500' 
                      : trafficStatus.status === 'warning' 
                        ? 'text-yellow-600' 
                        : 'text-[var(--foreground)]'
                  }`}>
                    {trafficStatus.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
            {/* No traffic limit set - show settings button */}
            {(!trafficLimitGB || trafficLimitGB === 0) && onTrafficSettings && (
              <div className="flex justify-end pt-1 mt-1 border-t border-dashed border-[var(--border)]">
                <button
                  onClick={(e) => { e.stopPropagation(); onTrafficSettings(id); }}
                  className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                  title="设置流量上限"
                >
                  <Settings className="w-3 h-3" />
                  <span>设置流量上限</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-[10px] text-[var(--muted-foreground)]">
          暂无数据
        </div>
      )}
    </div>
  );
}
