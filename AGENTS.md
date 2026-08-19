# AGENTS.md - VPS Monitor

## 项目概览
VPS 监控系统，包含中央仪表盘和 VPS 监控 Agent。

- **中央仪表盘**: Next.js 全栈应用，接收 Agent 上报的指标数据并可视化展示
- **VPS Agent**: 独立 Node.js 脚本，部署在各 VPS 上定期采集 CPU/内存/网络指标并上报

## 技术栈
- Next.js 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Recharts (图表)
- 内存数据存储 (生产环境需替换为持久化数据库)

## 目录结构
```
src/
├── app/
│   ├── api/
│   │   ├── agent/report/route.ts   # POST - Agent 上报指标
│   │   └── servers/
│   │       ├── route.ts             # GET - 获取服务器列表
│   │       └── [id]/metrics/route.ts # GET - 获取服务器指标历史
│   ├── layout.tsx                   # 根布局
│   ├── page.tsx                     # 仪表盘主页
│   └── globals.css                  # 全局样式 (暗色主题)
├── components/
│   ├── dashboard/
│   │   ├── server-card.tsx          # 服务器卡片组件
│   │   ├── server-detail.tsx        # 服务器详情页
│   │   ├── metrics-chart.tsx        # 指标图表组件
│   │   └── status-indicator.tsx     # 状态指示灯
│   └── font-preload.tsx             # 字体预加载
├── lib/
│   ├── store.ts                     # 内存数据存储
│   └── utils.ts                     # 工具函数
public/
└── agent/
    └── vps-monitor.js               # VPS 监控 Agent 脚本
```

## 构建与运行
```bash
pnpm install          # 安装依赖
pnpm run dev          # 启动开发环境
pnpm run build        # 构建生产版本
pnpm run start        # 启动生产环境
pnpm ts-check         # TypeScript 类型检查
pnpm lint             # ESLint 检查
```

## API 接口
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/servers` | GET | 获取所有服务器列表及最新指标 |
| `/api/servers/[id]/metrics` | GET | 获取指定服务器的指标历史 (最近60条) |
| `/api/agent/report` | POST | Agent 上报指标 (需 Bearer Token 认证) |

## Agent 部署
```bash
AGENT_SECRET="your-secret" SERVER_URL="http://your-server:5000" node public/agent/vps-monitor.js
```

## 代码规范
- 默认暗色主题，颜色变量定义在 globals.css
- 使用 shadcn/ui 组件库
- 函数参数必须标注类型，禁止隐式 any
- 客户端组件必须标注 'use client'
- 使用 font-mono 类展示等宽数字
