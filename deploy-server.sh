#!/bin/bash
#
# VPS 监控面板 - 一键部署脚本
# 用法: curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/vps-monitor/main/deploy-server.sh | bash
# 或: bash deploy-server.sh
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
INSTALL_DIR="/opt/vps-monitor"
SERVICE_NAME="vps-monitor"
PORT="${PORT:-8080}"
AGENT_SECRET="${AGENT_SECRET:-vps-monitor-default-secret}"

# 打印信息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 检查 root 权限
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "请使用 root 用户运行此脚本"
    fi
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        error "无法检测操作系统"
    fi
    info "检测到系统: $OS $VER"
}

# 安装 Node.js
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VER=$(node --version)
        success "Node.js 已安装: $NODE_VER"
        return
    fi

    info "正在安装 Node.js..."
    
    case "$OS" in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
            ;;
        centos|rhel|fedora|almalinux|rocky)
            if [ "$VER" = "7" ]; then
                # CentOS 7 使用 Node.js 16
                yum install -y epel-release
                yum install -y nodejs npm
            else
                curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
                yum install -y nodejs
            fi
            ;;
        *)
            warn "未知系统，尝试使用 npm 安装..."
            curl -fsSL https://fnm.vercel.app/install | bash
            export PATH="$HOME/.local/share/fnm:$PATH"
            eval "$(fnm env)"
            fnm install 18
            ;;
    esac

    if command -v node &> /dev/null; then
        success "Node.js 安装完成: $(node --version)"
    else
        error "Node.js 安装失败"
    fi
}

# 安装 pnpm
install_pnpm() {
    if command -v pnpm &> /dev/null; then
        success "pnpm 已安装: $(pnpm --version)"
        return
    fi

    info "正在安装 pnpm..."
    npm install -g pnpm
    success "pnpm 安装完成: $(pnpm --version)"
}

# 下载项目
download_project() {
    if [ -d "$INSTALL_DIR" ]; then
        warn "目录 $INSTALL_DIR 已存在，备份为 ${INSTALL_DIR}.bak"
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak"
    fi

    info "正在下载项目..."
    mkdir -p "$INSTALL_DIR"
    
    # 从 GitHub 下载
    curl -sSL "https://github.com/YOUR_USERNAME/vps-monitor/archive/refs/heads/main.tar.gz" | tar -xz -C "$INSTALL_DIR" --strip-components=1
    
    success "项目下载完成"
}

# 安装依赖
install_deps() {
    info "正在安装依赖..."
    cd "$INSTALL_DIR"
    pnpm install --prod
    success "依赖安装完成"
}

# 构建项目
build_project() {
    info "正在构建项目..."
    cd "$INSTALL_DIR"
    pnpm run build
    success "构建完成"
}

# 创建 systemd 服务
create_service() {
    info "创建系统服务..."
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=VPS Monitor Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=AGENT_SECRET=${AGENT_SECRET}
ExecStart=/usr/bin/npx next start -p ${PORT}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    success "服务创建完成"
}

# 启动服务
start_service() {
    info "启动服务..."
    systemctl start ${SERVICE_NAME}
    sleep 3
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        success "服务启动成功"
    else
        error "服务启动失败，请检查: journalctl -u ${SERVICE_NAME} -n 20"
    fi
}

# 配置防火墙
setup_firewall() {
    info "配置防火墙..."
    
    if command -v ufw &> /dev/null; then
        ufw allow ${PORT}/tcp 2>/dev/null || true
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=${PORT}/tcp 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
    elif command -v iptables &> /dev/null; then
        iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT 2>/dev/null || true
    fi
    
    success "防火墙配置完成"
}

# 显示完成信息
show_info() {
    IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    
    echo ""
    echo "=========================================="
    echo -e "${GREEN}VPS 监控面板部署完成!${NC}"
    echo "=========================================="
    echo ""
    echo "  访问地址: http://${IP}:${PORT}"
    echo "  Agent 密钥: ${AGENT_SECRET}"
    echo ""
    echo "  管理命令:"
    echo "    systemctl status ${SERVICE_NAME}   # 查看状态"
    echo "    systemctl restart ${SERVICE_NAME}  # 重启服务"
    echo "    journalctl -u ${SERVICE_NAME} -f   # 查看日志"
    echo ""
    echo "  Agent 部署命令:"
    echo "    curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/vps-monitor/main/deploy-agent.sh | bash -s -- --server http://${IP}:${PORT} --secret ${AGENT_SECRET}"
    echo ""
    echo "=========================================="
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  VPS 监控面板 - 一键部署"
    echo "=========================================="
    echo ""

    check_root
    detect_os
    install_nodejs
    install_pnpm
    download_project
    install_deps
    build_project
    create_service
    start_service
    setup_firewall
    show_info
}

main "$@"
