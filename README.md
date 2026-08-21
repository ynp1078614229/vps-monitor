# 🚀 VPS Monitor

> 轻量级 VPS 服务器监控系统，支持一键部署、实时监控、SSH 自动部署 Agent

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)

## ✨ 核心特性

- 🎯 **一键部署** - 一行命令完成面板/Agent 部署
- 🔐 **SSH 自动部署** - 面板端可远程自动部署 Agent 到任意服务器
- 📊 **实时监控** - CPU、内存、磁盘、网络流量（实时+累计）
- 🏷️ **服务器管理** - 添加、删除、编辑备注
- 🖥️ **多服务器支持** - 统一管理所有 VPS
- 🎨 **白色主题** - 简洁明亮的中文界面
- 📱 **响应式设计** - 桌面/平板/手机自适应
- ⚡ **轻量高效** - Agent 资源占用极低

## 🏗️ 架构

```
┌─────────────────┐         ┌──────────────────┐
│   监控面板       │         │   被监控 VPS     │
│  (Next.js)      │◄────────┤   (Node.js)      │
│                 │  HTTP   │                  │
│  ┌───────────┐  │         │  ┌────────────┐  │
│  │ 仪表盘    │  │  报告   │  │   Agent    │  │
│  │ API 服务  │  ├─────────┤  │  (5s/次)  │  │
│  │ 数据存储  │  │  控制   │  │            │  │
│  └───────────┘  │◄────────┤  └────────────┘  │
│                 │  SSH    │                  │
│  端口: 80       │  部署   │  端口: 22        │
└─────────────────┘         └──────────────────┘
```

## 🚀 快速开始

### 1️⃣ 部署监控面板（中央服务器）

**支持多实例运行**：每个实例使用独立端口，互不干扰。

**方式一：参数模式（适合测试/自动化）**
```bash
# 部署到端口 8080，密钥 my-secret
PORT=8080 AGENT_SECRET=my-secret bash -c "$(curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-server.sh)"

# 再部署一个到端口 9000
PORT=9000 AGENT_SECRET=another-secret bash -c "$(curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-server.sh)"
```

**方式二：交互模式（适合首次部署）**
```bash
# 下载脚本后运行，会提示输入端口和密钥
curl -sSL -o deploy-server.sh https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-server.sh
chmod +x deploy-server.sh
./deploy-server.sh
```

**多实例管理**：
```bash
# 查看所有实例
systemctl list-units --type=service | grep vps-monitor

# 管理特定端口的实例
systemctl status vps-monitor-8080    # 查看状态
systemctl restart vps-monitor-8080   # 重启
systemctl stop vps-monitor-8080      # 停止

# 查看日志
journalctl -u vps-monitor-8080 -f
```

### 2️⃣ 部署 Agent（被监控服务器）

**方式一：在监控面板中自动部署（推荐）**
1. 访问监控面板
2. 点击「添加」→「自动部署」
3. 输入目标服务器 SSH 信息
4. 点击「一键部署」，后台自动完成

**方式二：手动部署**
```bash
# 一键部署
curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-agent.sh | bash

# 自定义参数
curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-agent.sh | bash -s -- \
  --server http://103.6.235.231:80 \
  --secret my-secret \
  --id my-vps \
  --interval 5
```

**方式三：手动运行**
```bash
# 下载
curl -O https://your-server/agent/vps-monitor.js

# 运行
AGENT_SECRET=my-secret SERVER_URL=http://your-server:80 node vps-monitor.js
```

## 📖 功能详解

### 监控面板功能

| 功能 | 说明 |
|------|------|
| 服务器卡片 | 显示名称、IP、CPU、内存、网络流量 |
| 添加服务器 | 支持手动添加或 SSH 自动部署 |
| 删除服务器 | 一键删除服务器及其所有数据 |
| 编辑备注 | 在卡片上直接编辑服务器备注 |
| 实时刷新 | 每 5 秒自动刷新数据 |
| 指标图表 | CPU/内存/网络历史趋势图（详情页） |
| 累计流量 | 显示总下载/上传流量（自动单位换算） |

### Agent 采集指标

| 指标 | 说明 |
|------|------|
| CPU 使用率 | 总体 CPU 使用百分比 |
| 内存使用 | 已用/总量、使用率 |
| 磁盘使用 | 已用/总量、使用率 |
| 网络速度 | 实时上传/下载速度（KB/s, MB/s） |
| 累计流量 | 启动以来总上传/下载字节数 |
| 系统负载 | 1/5/15 分钟平均负载 |
| 运行时间 | 系统启动时长 |

## 🔧 API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/servers` | 获取所有服务器列表 |
| GET | `/api/servers/[id]/metrics` | 获取服务器指标历史（最近 60 条） |
| GET | `/api/server-info` | 获取面板公网 IP 和端口 |
| POST | `/api/agent/report` | Agent 上报指标（需 Bearer Token） |
| POST | `/api/deploy` | SSH 自动部署 Agent |
| POST | `/api/servers` | 手动添加服务器 |
| DELETE | `/api/servers/[id]` | 删除服务器 |
| PATCH | `/api/servers` | 更新服务器备注 |

### Agent 上报示例

```bash
curl -X POST http://your-server/api/agent/report \
  -H "Authorization: Bearer vps-monitor-default-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "vps-01",
    "hostname": "my-server",
    "ip": "10.0.0.1",
    "os": "Ubuntu 22.04",
    "cpuCores": 4,
    "totalMemory": 8589934592,
    "metrics": {
      "cpuUsage": 45.2,
      "memoryUsed": 4294967296,
      "memoryUsage": 50.0,
      "networkRxBytes": 1500000,
      "networkTxBytes": 800000,
      "loadAvg1": 1.5,
      "uptime": 86400
    }
  }'
```

## 🛠️ 管理命令

### 监控面板

```bash
systemctl status vps-monitor    # 查看状态
systemctl restart vps-monitor   # 重启服务
systemctl stop vps-monitor      # 停止服务
journalctl -u vps-monitor -f    # 查看日志
```

### Agent

```bash
systemctl status vps-agent      # 查看状态
systemctl restart vps-agent     # 重启服务
systemctl stop vps-agent        # 停止服务
journalctl -u vps-agent -f      # 查看日志
```

## 🧑‍💻 开发

```bash
# 克隆仓库
git clone https://github.com/ynp1078614229/vps-monitor.git
cd vps-monitor

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

## 📁 目录结构

```
vps-monitor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/report/         # Agent 上报接口
│   │   │   ├── deploy/               # SSH 自动部署
│   │   │   ├── server-info/          # 面板信息
│   │   │   └── servers/              # 服务器管理
│   │   ├── layout.tsx                # 根布局
│   │   ├── page.tsx                  # 仪表盘主页
│   │   └── globals.css               # 全局样式
│   ├── components/
│   │   └── dashboard/                # 仪表盘组件
│   └── lib/
│       ├── store.ts                  # 数据存储
│       └── utils.ts                  # 工具函数
├── public/
│   └── agent/
│       └── vps-monitor.js            # Agent 脚本
├── deploy-server.sh                  # 面板部署脚本
├── deploy-agent.sh                   # Agent 部署脚本
└── README.md
```

## 🐛 故障排查

### 部署失败 - SSH 连接失败

监控面板服务器需要安装 `sshpass`：
```bash
apt-get update && apt-get install -y sshpass   # Ubuntu/Debian
yum install -y sshpass                          # CentOS/RHEL
```

### 部署失败 - ssh2 模块加载失败

需要安装编译工具：
```bash
apt-get install -y build-essential python3
cd /opt/vps-monitor && rm -rf node_modules && pnpm install --prod
```

### 端口被占用

修改 `.coze` 或 systemd 配置：
```bash
PORT=8080 bash -c "$(curl -sSL URL)"
```

### 防火墙阻止

开放端口：
```bash
ufw allow 80/tcp          # Ubuntu
firewall-cmd --add-port=80/tcp --permanent  # CentOS
```

## 📄 License

MIT © [ynp1078614229](https://github.com/ynp1078614229)

## 🙏 致谢

- [Next.js](https://nextjs.org) - React 框架
- [Recharts](https://recharts.org) - 图表库
- [shadcn/ui](https://ui.shadcn.com) - UI 组件
- [Tailwind CSS](https://tailwindcss.com) - CSS 框架

---

⭐ 如果这个项目对你有帮助，请给个 Star！
