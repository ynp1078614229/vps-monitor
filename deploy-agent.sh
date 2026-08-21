#!/bin/bash
#
# VPS Monitor Agent - 一键部署脚本
#
# 用法:
#   curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-agent.sh | bash -s -- --server https://your-server --secret your-secret
#   bash deploy-agent.sh --server https://your-server --secret your-secret
#

set -e

# 颜色
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
INTERVAL="5"

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --server|-s)   SERVER_URL="$2"; shift 2 ;;
            --secret|-k)   AGENT_SECRET="$2"; shift 2 ;;
            --interval|-i) INTERVAL="$2"; shift 2 ;;
            --help|-h)     show_usage; exit 0 ;;
            *) echo "未知参数: $1"; show_usage; exit 1 ;;
        esac
    done
}

show_usage() {
    cat << 'EOF'

  VPS Monitor Agent - 一键部署

  用法:
    bash deploy-agent.sh --server <面板地址> --secret <认证密钥>

  参数:
    --server,  -s   面板地址 (必填，如 https://monitor.example.com)
    --secret,  -k   认证密钥 (必填，面板部署时设置的 AGENT_SECRET)
    --interval,-i   上报间隔秒数 (默认: 5)
    --help,    -h   显示帮助

  示例:
    bash deploy-agent.sh --server https://monitor.example.com --secret my-secret-key

  一键安装 (无需下载脚本):
    curl -sSL https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/deploy-agent.sh | bash -s -- \
      --server https://monitor.example.com --secret my-secret-key

EOF
}

# 检查参数
check_args() {
    [ -z "$SERVER_URL" ] && err "缺少 --server 参数，请使用 --help 查看帮助"
    [ -z "$AGENT_SECRET" ] && err "缺少 --secret 参数，请使用 --help 查看帮助"

    # 清理 URL 末尾的斜杠
    SERVER_URL="${SERVER_URL%/}"
}

# 检查 root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        err "请使用 root 用户运行此脚本"
    fi
}

# 安装 Node.js
install_nodejs() {
    if command -v node &> /dev/null; then
        ok "Node.js 已安装: $(node --version)"
        return
    fi

    info "正在安装 Node.js..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        OS="unknown"
    fi

    case "$OS" in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
            apt-get install -y nodejs > /dev/null 2>&1
            ;;
        centos|rhel|fedora|almalinux|rocky)
            if [ "${VERSION_ID%%.*}" = "7" ]; then
                yum install -y epel-release > /dev/null 2>&1
                yum install -y nodejs > /dev/null 2>&1
            else
                curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
                yum install -y nodejs > /dev/null 2>&1
            fi
            ;;
        *)
            # 使用二进制包直接安装
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  ARCH="x64" ;;
                aarch64) ARCH="arm64" ;;
                armv7l)  ARCH="armv7l" ;;
                *) err "不支持的架构: $ARCH" ;;
            esac
            NODE_VERSION="v20.18.0"
            info "下载 Node.js ${NODE_VERSION} (${ARCH})..."
            curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-${ARCH}.tar.xz" | tar -xJ -C /usr/local --strip-components=1
            ;;
    esac

    if command -v node &> /dev/null; then
        ok "Node.js 安装完成: $(node --version)"
    else
        err "Node.js 安装失败"
    fi
}

# 下载 Agent 脚本
download_agent() {
    info "下载 Agent 脚本..."

    if [ -d "$INSTALL_DIR" ]; then
        # 备份旧版本
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi

    mkdir -p "$INSTALL_DIR"

    # 从 GitHub 下载
    if curl -fsSL "https://raw.githubusercontent.com/ynp1078614229/vps-monitor/main/public/agent/vps-monitor.js" \
        -o "${INSTALL_DIR}/vps-monitor.js" 2>/dev/null; then
        ok "Agent 脚本下载完成"
    else
        err "Agent 脚本下载失败，请检查网络连接"
    fi
}

# 创建 systemd 服务
create_service() {
    info "创建系统服务..."

    # 停止旧服务
    systemctl stop ${SERVICE_NAME} 2>/dev/null || true

    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=VPS Monitor Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=$(command -v node) ${INSTALL_DIR}/vps-monitor.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=SERVER_URL=${SERVER_URL}
Environment=AGENT_SECRET=${AGENT_SECRET}
Environment=INTERVAL=${INTERVAL}

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME} > /dev/null 2>&1
    ok "服务创建完成"
}

# 启动并验证
start_and_verify() {
    info "启动 Agent..."
    systemctl start ${SERVICE_NAME}
    sleep 3

    if systemctl is-active --quiet ${SERVICE_NAME}; then
        ok "Agent 启动成功"
    else
        err "Agent 启动失败，请检查: journalctl -u ${SERVICE_NAME} -n 20"
    fi

    # 验证上报
    info "验证数据上报..."
    sleep 6

    if journalctl -u ${SERVICE_NAME} --no-pager --since "10 sec ago" | grep -q "\[OK\]"; then
        ok "数据上报正常"
    else
        warn "未检测到上报日志，可能需要等待更长时间"
    fi
}

# 显示完成信息
show_info() {
    HOSTNAME=$(hostname)
    echo ""
    echo "=========================================="
    echo -e "${GREEN}VPS Monitor Agent 部署完成!${NC}"
    echo "=========================================="
    echo ""
    echo "  服务器: ${HOSTNAME}"
    echo "  面板:   ${SERVER_URL}"
    echo "  间隔:   ${INTERVAL} 秒"
    echo ""
    echo "  管理命令:"
    echo "    systemctl status ${SERVICE_NAME}   # 查看状态"
    echo "    systemctl restart ${SERVICE_NAME}  # 重启"
    echo "    systemctl stop ${SERVICE_NAME}     # 停止"
    echo "    journalctl -u ${SERVICE_NAME} -f   # 查看日志"
    echo ""
    echo "  卸载:"
    echo "    systemctl stop ${SERVICE_NAME} && systemctl disable ${SERVICE_NAME}"
    echo "    rm -rf ${INSTALL_DIR} /etc/systemd/system/${SERVICE_NAME}.service"
    echo "    systemctl daemon-reload"
    echo ""
    echo "=========================================="
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  VPS Monitor Agent - 一键部署"
    echo "=========================================="
    echo ""

    parse_args "$@"
    check_args
    check_root
    install_nodejs
    download_agent
    create_service
    start_and_verify
    show_info
}

main "$@"
