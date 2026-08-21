#!/bin/bash
# VPS Monitor 多实例部署脚本
# 用法: curl -sSL URL | bash -s -- --name mypanel --port 8080

set -e

# 默认值
INSTANCE_NAME="vps-monitor"
PORT="80"
AGENT_SECRET="vps-monitor-default-secret"
DATA_DIR="/opt/vps-monitor"

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --name) INSTANCE_NAME="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --secret) AGENT_SECRET="$2"; shift 2 ;;
    --data-dir) DATA_DIR="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

INSTALL_DIR="${DATA_DIR}/${INSTANCE_NAME}"
SERVICE_NAME="vps-monitor-${INSTANCE_NAME}"

echo "=========================================="
echo "VPS 监控面板 - 多实例部署"
echo "=========================================="
echo "实例名称: ${INSTANCE_NAME}"
echo "监听端口: ${PORT}"
echo "安装目录: ${INSTALL_DIR}"
echo "服务名称: ${SERVICE_NAME}"
echo "=========================================="

# 安装 Node.js（如果未安装）
if ! command -v node &> /dev/null; then
  echo "[INFO] 安装 Node.js..."
  if command -v apt-get &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs
  elif command -v yum &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    yum install -y nodejs
  fi
fi

# 安装依赖
echo "[INFO] 安装依赖..."
if ! command -v sshpass &> /dev/null; then
  apt-get install -y sshpass 2>/dev/null || yum install -y sshpass 2>/dev/null
fi

# 创建实例目录
mkdir -p ${INSTALL_DIR}
cd ${INSTALL_DIR}

# 下载预构建版本
echo "[INFO] 下载预构建版本..."
RELEASE_URL="https://github.com/ynp1078614229/vps-monitor/releases/download/v1.0.0/vps-monitor.tar.gz"
curl -sSL -o /tmp/vps-monitor.tar.gz ${RELEASE_URL}
tar -xzf /tmp/vps-monitor.tar.gz -C ${INSTALL_DIR}
rm -f /tmp/vps-monitor.tar.gz

# 安装 npm 依赖
echo "[INFO] 安装 npm 依赖..."
pnpm install --prod 2>&1 | tail -3

# 创建 systemd 服务
echo "[INFO] 创建系统服务..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=VPS Monitor Dashboard - ${INSTANCE_NAME}
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=AGENT_SECRET=${AGENT_SECRET}
Environment=INSTANCE_NAME=${INSTANCE_NAME}
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p ${PORT}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

# 配置防火墙
if command -v ufw &> /dev/null; then
  ufw allow ${PORT}/tcp 2>/dev/null
elif command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port=${PORT}/tcp 2>/dev/null
  firewall-cmd --reload 2>/dev/null
fi

sleep 3

echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "访问地址: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):${PORT}"
echo "服务名称: ${SERVICE_NAME}"
echo "管理命令: systemctl {start|stop|restart|status} ${SERVICE_NAME}"
echo "=========================================="
