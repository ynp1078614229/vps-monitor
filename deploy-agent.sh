#!/bin/bash
#
# VPS 监控 Agent - 一键部署脚本
# 用法: curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-agent.sh | bash -s -- --server http://your-server:8080 --secret your-secret
# 或: bash deploy-agent.sh --server http://your-server:8080 --secret your-secret
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认配置
INSTALL_DIR="/opt/vps-agent"
SERVICE_NAME="vps-agent"
SERVER_URL=""
AGENT_SECRET=""
SERVER_ID=""
REPORT_INTERVAL=5

# 打印信息
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 显示帮助
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --server URL      监控面板地址 (必填)"
    echo "  --secret KEY      认证密钥 (必填)"
    echo "  --id NAME         服务器标识 (默认: hostname)"
    echo "  --interval SEC    上报间隔秒数 (默认: 5)"
    echo "  --help            显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 --server http://103.6.235.231:8080 --secret vps-monitor-default-secret"
    echo "  $0 --server http://monitor.example.com --secret my-secret --id my-vps-01"
    exit 0
}

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --server)
                SERVER_URL="$2"
                shift 2
                ;;
            --secret)
                AGENT_SECRET="$2"
                shift 2
                ;;
            --id)
                SERVER_ID="$2"
                shift 2
                ;;
            --interval)
                REPORT_INTERVAL="$2"
                shift 2
                ;;
            --help)
                show_help
                ;;
            *)
                error "未知参数: $1"
                ;;
        esac
    done

    if [ -z "$SERVER_URL" ]; then
        error "请提供监控面板地址: --server URL"
    fi

    if [ -z "$AGENT_SECRET" ]; then
        error "请提供认证密钥: --secret KEY"
    fi

    if [ -z "$SERVER_ID" ]; then
        SERVER_ID=$(hostname)
    fi
}

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

# 下载 Agent 脚本
download_agent() {
    if [ -d "$INSTALL_DIR" ]; then
        warn "目录 $INSTALL_DIR 已存在，备份为 ${INSTALL_DIR}.bak"
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak"
    fi

    info "正在下载 Agent 脚本..."
    mkdir -p "$INSTALL_DIR"
    
    # 尝试从监控面板下载
    curl -sSL -o "$INSTALL_DIR/vps-monitor.js" "${SERVER_URL}/agent/vps-monitor.js"
    
    if [ ! -f "$INSTALL_DIR/vps-monitor.js" ]; then
        # 从 GitHub 下载
        curl -sSL -o "$INSTALL_DIR/vps-monitor.js" "https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/public/agent/vps-monitor.js"
    fi
    
    if [ -f "$INSTALL_DIR/vps-monitor.js" ]; then
        success "Agent 脚本下载完成"
    else
        error "Agent 脚本下载失败"
    fi
}

# 创建 systemd 服务
create_service() {
    info "创建系统服务..."
    
    # 查找 node 路径
    NODE_PATH=$(which node)
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=VPS Monitor Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
Environment=AGENT_SECRET=${AGENT_SECRET}
Environment=SERVER_URL=${SERVER_URL}
Environment=SERVER_ID=${SERVER_ID}
Environment=REPORT_INTERVAL=${REPORT_INTERVAL}
ExecStart=${NODE_PATH} vps-monitor.js
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

# 验证连接
verify_connection() {
    info "验证与监控面板的连接..."
    sleep 6
    
    if journalctl -u ${SERVICE_NAME} -n 10 --no-pager | grep -q "Metrics reported successfully"; then
        success "数据上报成功!"
    else
        warn "未检测到成功上报，请检查网络和配置"
    fi
}

# 显示完成信息
show_info() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}VPS 监控 Agent 部署完成!${NC}"
    echo "=========================================="
    echo ""
    echo "  监控面板: ${SERVER_URL}"
    echo "  服务器 ID: ${SERVER_ID}"
    echo "  上报间隔: ${REPORT_INTERVAL} 秒"
    echo ""
    echo "  管理命令:"
    echo "    systemctl status ${SERVICE_NAME}   # 查看状态"
    echo "    systemctl restart ${SERVICE_NAME}  # 重启服务"
    echo "    journalctl -u ${SERVICE_NAME} -f   # 查看日志"
    echo "    systemctl stop ${SERVICE_NAME}     # 停止服务"
    echo ""
    echo "=========================================="
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  VPS 监控 Agent - 一键部署"
    echo "=========================================="
    echo ""

    parse_args "$@"
    check_root
    detect_os
    install_nodejs
    download_agent
    create_service
    start_service
    verify_connection
    show_info
}

main "$@"
