#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/opt/dcc_04.30"
APP_NAME="dcc_04_30"
APP_NAME_API="${APP_NAME}_api"
FRONTEND_DIR="${APP_DIR}/frontend"
BACKEND_DIR="${APP_DIR}/backend"
PORT_FRONTEND="3110"
PORT_BACKEND="3111"
DOMAIN="clues-demo.kongbaijiyi.com"
NGINX_CONF="/etc/nginx/conf.d/${APP_NAME}.conf"
SYSTEMD_SERVICE="/etc/systemd/system/${APP_NAME}.service"
SYSTEMD_SERVICE_API="/etc/systemd/system/${APP_NAME_API}.service"

echo "==> 开始部署 ${APP_NAME}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 运行该脚本。"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 20+。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未检测到 npm，请先安装 npm。"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未检测到 python3，请先安装 Python 3.11+。"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "未检测到 Nginx，尝试自动安装..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    echo "无法识别包管理器，请手动安装 Nginx。"
    exit 1
  fi
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "目录不存在：${APP_DIR}"
  echo "请先把项目代码放到该目录。"
  exit 1
fi

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "前端目录不存在：${FRONTEND_DIR}"
  exit 1
fi

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "后端目录不存在：${BACKEND_DIR}"
  exit 1
fi

# 企业微信等密钥：与仓库中 env.example 同结构，放在应用根目录 .env
# - npm run build 会读入 NEXT_PUBLIC_* 打入前端
# - systemd 通过 EnvironmentFile 为后端提供 WECOM_*
ENV_FILE="${APP_DIR}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  echo "==> 加载环境变量: ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
else
  echo "==> 提示: 未找到 ${ENV_FILE}（可将 env.example 复制为 .env 并填写企业微信等配置）"
fi

# 先停掉已有实例，释放端口与内存，避免 restart 长时间等待或端口占用导致新进程起不来
echo "==> 停止已有应用服务（若存在）"
systemctl stop "${APP_NAME}" 2>/dev/null || true
systemctl stop "${APP_NAME_API}" 2>/dev/null || true
sleep 2

echo "==> 安装前端依赖"
cd "${FRONTEND_DIR}"
npm ci

echo "==> 构建前端"
npm run build

echo "==> 安装 Python 后端（venv）"
cd "${BACKEND_DIR}"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "==> 写入 systemd 服务 ${SYSTEMD_SERVICE}（Next.js）"
cat > "${SYSTEMD_SERVICE}" <<EOF
[Unit]
Description=Next.js App ${APP_NAME}
After=network.target

[Service]
Type=simple
WorkingDirectory=${FRONTEND_DIR}
ExecStart=/usr/bin/env npm run start -- -p ${PORT_FRONTEND}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=-${APP_DIR}/.env
User=root
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

echo "==> 写入 systemd 服务 ${SYSTEMD_SERVICE_API}（FastAPI）"
cat > "${SYSTEMD_SERVICE_API}" <<EOF
[Unit]
Description=FastAPI ${APP_NAME_API}
After=network.target

[Service]
Type=simple
WorkingDirectory=${BACKEND_DIR}
ExecStart=${BACKEND_DIR}/.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port ${PORT_BACKEND}
Restart=always
RestartSec=5
EnvironmentFile=-${APP_DIR}/.env
User=root
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

echo "==> 重载并重启应用服务"
systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl enable "${APP_NAME_API}"
systemctl restart "${APP_NAME_API}"
systemctl restart "${APP_NAME}"

echo "==> 写入 Nginx 配置 ${NGINX_CONF}"
cat > "${NGINX_CONF}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /api/ {
        proxy_pass http://127.0.0.1:${PORT_BACKEND};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${PORT_FRONTEND};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo "==> 检查并重载 Nginx"
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> 部署完成"
echo "应用目录: ${APP_DIR}"
echo "前端端口: ${PORT_FRONTEND}"
echo "后端端口: ${PORT_BACKEND}（经 Nginx /api/ 对外）"
echo "域名访问: http://${DOMAIN}"
echo
echo "常用检查命令："
echo "  systemctl status ${APP_NAME}"
echo "  systemctl status ${APP_NAME_API}"
echo "  journalctl -u ${APP_NAME} -f"
echo "  journalctl -u ${APP_NAME_API} -f"
echo "  systemctl status nginx"
