'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServerCard } from '@/components/dashboard/server-card';
import { ServerDetail } from '@/components/dashboard/server-detail';
import { Activity, Server as ServerIcon, RefreshCw } from 'lucide-react';

interface ServerData {
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
}

export default function DashboardPage() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/servers');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setServers(data.servers);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Fetch servers error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 15_000);
    return () => clearInterval(interval);
  }, [fetchServers]);

  const onlineCount = servers.filter((s) => s.online).length;
  const offlineCount = servers.length - onlineCount;

  // If a server is selected, show detail view
  if (selectedServer) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ServerDetail
            serverId={selectedServer}
            onBack={() => setSelectedServer(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--card)] border border-[var(--border)]">
              <Activity className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">
                VPS 监控
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                实时服务器状态监控仪表盘
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <ServerIcon className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">总计:</span>
                <span className="metric-value text-[var(--foreground)]">
                  {servers.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--status-online)]" />
                <span className="metric-value text-[var(--status-online)]">
                  {onlineCount}
                </span>
              </div>
              {offlineCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--status-offline)]" />
                  <span className="metric-value text-[var(--status-offline)]">
                    {offlineCount}
                  </span>
                </div>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={fetchServers}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">刷新</span>
            </button>
          </div>
        </div>

        {/* Last refresh time */}
        {lastRefresh && (
          <div className="text-xs text-[var(--muted-foreground)] mb-4 font-mono">
            最后更新: {lastRefresh.toLocaleTimeString()}
          </div>
        )}

        {/* Server Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-[var(--muted-foreground)]">
              加载服务器列表中...
            </div>
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <ServerIcon className="w-12 h-12 text-[var(--muted-foreground)]" />
            <div className="text-center">
              <p className="text-[var(--foreground)] font-medium mb-1">
                暂无监控服务器
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                在 VPS 上部署监控 Agent 开始采集数据
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                id={server.id}
                hostname={server.hostname}
                ip={server.ip}
                os={server.os}
                cpuCores={server.cpuCores}
                totalMemory={server.totalMemory}
                online={server.online}
                lastSeen={server.lastSeen}
                latest={server.latest}
                onClick={() => setSelectedServer(server.id)}
              />
            ))}
          </div>
        )}

        {/* Agent deployment info */}
        <div className="mt-12 bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
            部署监控 Agent
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            在您的 VPS 上运行以下命令，开始采集服务器指标：
          </p>
          <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-4 font-mono text-xs text-[var(--muted-foreground)] overflow-x-auto">
            <pre>{`# 下载并运行 VPS 监控 Agent
curl -o vps-monitor.js <your-server-url>/agent/vps-monitor.js
AGENT_SECRET="your-secret" SERVER_URL="<your-server-url>" node vps-monitor.js`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
