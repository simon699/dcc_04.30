#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/opt/dcc_04.30"
APP_NAME="dcc_04_30"
PORT="3110"
DOMAIN="dcc-demo.kongbaijiyi.com"
NGINX_CONF="/etc/nginx/conf.d/${APP_NAME}.conf"
SYSTEMD_SERVICE="/etc/systemd/system/${APP_NAME}.service"

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

cd "${APP_DIR}"

echo "==> 安装依赖"
npm ci

echo "==> 构建项目"
npm run build

echo "==> 写入 systemd 服务 ${SYSTEMD_SERVICE}"
cat > "${SYSTEMD_SERVICE}" <<EOF
[Unit]
Description=Next.js App ${APP_NAME}
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/env npm run start -- -p ${PORT}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=root

[Install]
WantedBy=multi-user.target
EOF

echo "==> 重载并重启应用服务"
systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl restart "${APP_NAME}"

echo "==> 写入 Nginx 配置 ${NGINX_CONF}"
cat > "${NGINX_CONF}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
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
echo "应用端口: ${PORT}"
echo "域名访问: http://${DOMAIN}"
echo
echo "常用检查命令："
echo "  systemctl status ${APP_NAME}"
echo "  journalctl -u ${APP_NAME} -f"
echo "  systemctl status nginx"
