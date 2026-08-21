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

# 卸载函数
uninstall() {
  local name="$1"
  if [ -z "$name" ]; then
    echo "用法: $0 --uninstall <实例名称>"
    echo ""
    echo "已安装的实例:"
    for service in $(systemctl list-units --type=service --no-legend | grep "vps-monitor-" | awk '{print $1}'); do
      local iname=$(echo "$service" | sed 's/vps-monitor-//' | sed 's/\.service//')
      local port=$(systemctl show "$service" -p Environment --value 2>/dev/null | grep -oP 'PORT=\K[0-9]+' || echo "?")
      local status=$(systemctl is-active "$service" 2>/dev/null || echo "inactive")
      echo "  - $iname (端口: $port, 状态: $status)"
    done
    echo ""
    echo "示例: $0 --uninstall panel-a"
    exit 0
  fi

  local service_name="vps-monitor-${name}.service"
  local install_dir="/opt/vps-monitor/${name}"

  echo "=========================================="
  echo "卸载实例: $name"
  echo "=========================================="

  if ! systemctl list-unit-files "$service_name" &>/dev/null; then
    echo "[ERROR] 实例 $name 不存在"
    exit 1
  fi

  read -p "确认卸载实例 $name ? [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
  fi

  echo "[INFO] 停止服务..."
  systemctl stop "$service_name" 2>/dev/null || true
  echo "[INFO] 禁用服务..."
  systemctl disable "$service_name" 2>/dev/null || true
  echo "[INFO] 删除服务文件..."
  rm -f "/etc/systemd/system/$service_name"
  echo "[INFO] 删除安装目录..."
  rm -rf "$install_dir"
  echo "[INFO] 重新加载 systemd..."
  systemctl daemon-reload

  # 删除防火墙规则
  if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
    local port=$(systemctl show "vps-monitor-${name}.service" -p Environment --value 2>/dev/null | grep -oP 'PORT=\K[0-9]+' || true)
    if [ -n "$port" ]; then
      echo "[INFO] 删除防火墙规则 (端口 $port)..."
      ufw delete allow "$port" 2>/dev/null || true
    fi
  fi

  echo "[OK] 实例 $name 卸载完成"
}

# 主菜单
main_menu() {
  echo "=========================================="
  echo "VPS 监控面板 - 管理菜单"
  echo "=========================================="
  echo ""
  echo "  1) 安装新实例"
  echo "  2) 卸载实例"
  echo "  3) 查看已安装实例"
  echo "  4) 退出"
  echo ""
  read -p "请选择 [1-4]: " choice

  case $choice in
    1)
      read -p "实例名称 (默认: vps-monitor): " name
      read -p "监听端口 (默认: 80): " port
      read -p "认证密钥 (默认: vps-monitor-default-secret): " secret
      [ -z "$name" ] && name="vps-monitor"
      [ -z "$port" ] && port="80"
      [ -z "$secret" ] && secret="vps-monitor-default-secret"
      echo ""
      # 递归调用自己进行安装
      exec "$0" --name "$name" --port "$port" --secret "$secret"
      ;;
    2)
      uninstall
      read -p "请输入要卸载的实例名称: " name
      [ -n "$name" ] && uninstall "$name"
      ;;
    3)
      uninstall
      ;;
    4)
      exit 0
      ;;
    *)
      echo "无效选择"
      exit 1
      ;;
  esac
}

# 处理卸载参数
if [ "$1" = "--uninstall" ] || [ "$1" = "-u" ]; then
  uninstall "$2"
  exit 0
fi

# 无参数时进入菜单
if [ $# -eq 0 ]; then
  main_menu
  exit 0
fi
