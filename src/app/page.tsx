'use client';

import { useState, useEffect, useCallback } from 'react';
import { ServerCard } from '@/components/dashboard/server-card';
import { ServerDetail } from '@/components/dashboard/server-detail';
import { Activity, Server as ServerIcon, RefreshCw, Plus, X } from 'lucide-react';

interface ServerData {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  cpuCores: number;
  totalMemory: number;
  online: boolean;
  lastSeen: number;
  remark?: string;
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
}

export default function DashboardPage() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm('确定要删除此服务器吗？所有监控数据将被清除。')) return;
    try {
      const res = await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      if (res.ok) {
        setServers((prev) => prev.filter((s) => s.id !== serverId));
      }
    } catch (err) {
      console.error('Delete server error:', err);
    }
  };

  const handleUpdateRemark = async (serverId: string, remark: string) => {
    try {
      await fetch('/api/servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: serverId, remark }),
      });
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, remark } : s))
      );
    } catch (err) {
      console.error('Update remark error:', err);
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 5_000);
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
            onDelete={() => {
              handleDeleteServer(selectedServer);
              setSelectedServer(null);
            }}
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

            {/* Add button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">添加</span>
            </button>

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
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                点击「添加」按钮或部署 Agent 开始采集数据
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                添加服务器
              </button>
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
                remark={server.remark}
                latest={server.latest}
                onClick={() => setSelectedServer(server.id)}
                onDelete={() => handleDeleteServer(server.id)}
                onRemarkUpdate={handleUpdateRemark}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <AddServerModal onClose={() => setShowAddModal(false)} onAdded={fetchServers} />
      )}
    </div>
  );
}

function AddServerModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  // Auto deploy fields
  const [sshIp, setSshIp] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [monitorUrl, setMonitorUrl] = useState('');
  // Manual fields
  const [serverId, setServerId] = useState('');
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [remark, setRemark] = useState('');
  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [deployDone, setDeployDone] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  // 获取当前服务器公网 IP 作为默认监控地址
  useEffect(() => {
    fetch('/api/server-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.monitorUrl && !monitorUrl) {
          setMonitorUrl(data.monitorUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleAutoDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sshIp || !sshUser || !sshPassword) return;

    // 先测试 SSH 连接（此时弹窗保持打开，显示加载状态）
    setDeploying(true);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: sshIp,
          port: parseInt(sshPort) || 22,
          username: sshUser,
          password: sshPassword,
          serverId: serverId || undefined,
          hostname: hostname || undefined,
          secret: 'vps-monitor-default-secret',
          monitorUrl: monitorUrl || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // SSH 连接成功，关闭弹窗，后台继续部署
        onClose();
        // 显示提示（可选：可以添加 toast 通知）
        alert('SSH 连接成功，正在后台部署监控 Agent...\nAgent 部署完成后将自动显示在监控面板。');
        // 刷新列表
        onAdded();
      } else {
        // SSH 连接失败，显示错误，保持弹窗打开
        alert(`部署失败: ${data.error || '未知错误'}`);
        setDeploying(false);
      }
    } catch (err) {
      alert(`请求失败: ${err instanceof Error ? err.message : '网络错误'}`);
      setDeploying(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverId || !ip) return;

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          hostname: hostname || serverId,
          ip,
          remark,
        }),
      });
      if (res.ok) {
        onAdded();
        onClose();
      }
    } catch (err) {
      console.error('Add server error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">添加服务器</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`flex-1 px-4 py-2 text-sm rounded-lg border transition-colors ${
              mode === 'auto'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)]'
            }`}
          >
            自动部署
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 px-4 py-2 text-sm rounded-lg border transition-colors ${
              mode === 'manual'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)]'
            }`}
          >
            手动添加
          </button>
        </div>

        {mode === 'auto' ? (
          <div>
            {!deployDone ? (
              <form onSubmit={handleAutoDeploy} className="space-y-4">
                <p className="text-xs text-[var(--muted-foreground)] mb-2">
                  通过 SSH 连接目标服务器，自动安装并启动监控 Agent
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                      IP 地址 *
                    </label>
                    <input
                      type="text"
                      value={sshIp}
                      onChange={(e) => setSshIp(e.target.value)}
                      placeholder="例如: 103.6.235.13"
                      className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                      required
                      disabled={deploying}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                      SSH 端口
                    </label>
                    <input
                      type="text"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      placeholder="22"
                      className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                      disabled={deploying}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    用户名 *
                  </label>
                  <input
                    type="text"
                    value={sshUser}
                    onChange={(e) => setSshUser(e.target.value)}
                    placeholder="root"
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                    required
                    disabled={deploying}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    密码 *
                  </label>
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="SSH 密码"
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                    required
                    disabled={deploying}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                    监控面板地址
                  </label>
                  <input
                    type="text"
                    value={monitorUrl}
                    onChange={(e) => setMonitorUrl(e.target.value)}
                    placeholder="例如: http://103.6.235.231:8080"
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                    disabled={deploying}
                  />
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Agent 部署后上报数据的目标地址，默认为当前服务器
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                    disabled={deploying}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={deploying}
                    className="flex-1 px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {deploying ? '部署中...' : '一键部署'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 p-3 rounded-lg ${deploySuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <span className={`text-sm font-medium ${deploySuccess ? 'text-green-700' : 'text-red-700'}`}>
                    {deploySuccess ? '部署成功！' : '部署失败'}
                  </span>
                </div>
                <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 max-h-48 overflow-y-auto">
                  <pre className="text-xs font-mono text-[var(--muted-foreground)] whitespace-pre-wrap">
                    {deployLogs.join('\n')}
                  </pre>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {deploySuccess ? '完成' : '关闭'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualAdd} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                服务器 ID *
              </label>
              <input
                type="text"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                placeholder="例如: vps-01"
                className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                主机名
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="例如: my-vps"
                className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                IP 地址 *
              </label>
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="例如: 192.168.1.100"
                className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                备注
              </label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="例如: 生产环境 Web 服务器"
                className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition-opacity"
              >
                添加
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
