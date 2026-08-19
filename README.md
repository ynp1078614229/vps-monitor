# VPS Monitor

一个轻量级的 VPS 监控系统，包含中央监控面板和部署在各 VPS 上的监控 Agent。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D16-green.svg)

## 功能特性

- **实时监控**: CPU、内存、磁盘使用率
- **网络流量**: 实时速率 + 累计流量统计
- **多服务器管理**: 支持同时监控多台 VPS
- **可视化图表**: 历史数据图表展示
- **自动刷新**: 5 秒间隔自动更新数据
- **轻量 Agent**: 无额外依赖，纯 Node.js 实现
- **Bearer Token 认证**: 安全的 Agent 通信

## 架构

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐
│   VPS Agent     │ ──────────────────► │  监控面板        │
│  (被监控端)      │    /api/agent/report│  (中央服务器)     │
└─────────────────┘                     └─────────────────┘
       │                                        │
       │ 采集系统指标                             │ 展示数据
       ▼                                        ▼
   CPU/内存/网络                           Web 仪表盘
```

## 快速开始

### 1. 部署监控面板

在中央服务器上运行：

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/vps-monitor/main/deploy-server.sh | bash
```

或手动部署：

```bash
git clone https://github.com/YOUR_USERNAME/vps-monitor.git
cd vps-monitor
pnpm install
pnpm run build
PORT=8080 pnpm run start
```

### 2. 部署监控 Agent

在被监控的 VPS 上运行：

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/vps-monitor/main/deploy-agent.sh | bash -s -- \
  --server http://your-monitor-server:8080 \
  --secret vps-monitor-default-secret
```

参数说明：
- `--server`: 监控面板地址
- `--secret`: 认证密钥（需与面板端一致）
- `--id`: 服务器标识（默认使用 hostname）
- `--interval`: 上报间隔秒数（默认 5）

## 一键部署脚本

### 监控面板端

```bash
# 默认配置
bash deploy-server.sh

# 自定义配置
PORT=3000 AGENT_SECRET=my-secret bash deploy-server.sh
```

### 被监控端

```bash
bash deploy-agent.sh --server http://monitor:8080 --secret my-secret --id my-vps-01
```

## API 接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/servers` | GET | 获取所有服务器列表 |
| `/api/servers/[id]/metrics` | GET | 获取服务器指标历史 |
| `/api/agent/report` | POST | Agent 上报指标 |

### Agent 上报数据格式

```json
{
  "serverId": "my-vps-01",
  "hostname": "vps-01",
  "ip": "192.168.1.100",
  "os": "Ubuntu 22.04 LTS",
  "kernel": "5.15.0",
  "cpuModel": "Intel Xeon E5-2686",
  "cpuCores": 4,
  "totalMemory": 8589934592,
  "totalDisk": 107374182400,
  "agentVersion": "1.0.0",
  "metrics": {
    "cpuUsage": 45.2,
    "memoryUsed": 4294967296,
    "memoryUsage": 50.0,
    "diskUsed": 53687091200,
    "diskUsage": 50.0,
    "networkRxBytes": 1500000,
    "networkTxBytes": 800000,
    "totalRxBytes": 1234567890,
    "totalTxBytes": 987654321,
    "loadAvg1": 1.5,
    "loadAvg5": 1.2,
    "loadAvg15": 0.8,
    "uptime": 86400
  }
}
```

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **样式**: Tailwind CSS 4
- **图表**: Recharts
- **Agent**: 纯 Node.js，无额外依赖

## 系统要求

### 监控面板
- Node.js >= 18
- 内存 >= 512MB

### 被监控端 (Agent)
- Node.js >= 16
- 内存 >= 64MB
- Linux 系统（用于读取 /proc 获取精确数据）

## 管理命令

### 监控面板

```bash
systemctl status vps-monitor   # 查看状态
systemctl restart vps-monitor  # 重启服务
journalctl -u vps-monitor -f   # 查看日志
systemctl stop vps-monitor     # 停止服务
```

### 监控 Agent

```bash
systemctl status vps-agent     # 查看状态
systemctl restart vps-agent    # 重启服务
journalctl -u vps-agent -f     # 查看日志
systemctl stop vps-agent       # 停止服务
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发环境
pnpm run dev

# 构建生产版本
pnpm run build

# 启动生产环境
pnpm run start

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint
```

## 目录结构

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/report/route.ts   # Agent 上报接口
│   │   │   └── servers/
│   │   │       ├── route.ts            # 服务器列表接口
│   │   │       └── [id]/metrics/route.ts # 指标历史接口
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── dashboard/
│   │       ├── server-card.tsx
│   │       ├── server-detail.tsx
│   │       ├── metrics-chart.tsx
│   │       └── status-indicator.tsx
│   └── lib/
│       ├── store.ts
│       └── utils.ts
├── public/
│   └── agent/
│       └── vps-monitor.js              # Agent 脚本
├── deploy-server.sh                    # 面板一键部署脚本
├── deploy-agent.sh                     # Agent 一键部署脚本
└── package.json
```

## License

MIT
