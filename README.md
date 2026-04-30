# DCC Demo 项目说明

这是一个基于 Next.js 的前端项目。

## 本地开发

### 环境要求

- Node.js 20+
- npm 10+

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
npm run dev
```

默认访问地址：`http://localhost:3000`

## 生产构建与启动（手动）

```bash
npm ci
npm run build
npm run start -- -p 3110
```

说明：
- 生产环境端口使用 `3110`
- 实际线上由 Nginx 反向代理对外提供访问

## 阿里云自动部署（推荐）

项目已提供自动部署脚本：`deploy.sh`

目标部署参数：
- 部署目录：`/opt/dcc_04.30`
- 应用端口：`3110`
- 访问域名：`dcc-demo.kongbaijiyi.com`
- 反向代理：Nginx

### 部署前准备

1. 将项目代码放到服务器目录：`/opt/dcc_04.30`
2. 确保服务器已安装 Node.js 与 npm
3. 确保域名 `dcc-demo.kongbaijiyi.com` 已解析到服务器公网 IP
4. 放行服务器安全组端口：`80`（如后续启用 HTTPS，再放行 `443`）

### 执行部署

```bash
cd /opt/dcc_04.30
sudo bash deploy.sh
```

脚本会自动执行：
- 安装依赖并构建项目
- 创建并启动 systemd 服务（服务名：`dcc_04_30`）
- 生成 Nginx 配置并重启 Nginx

部署完成后访问：

`http://dcc-demo.kongbaijiyi.com`

## 运维与排障

### 查看应用服务状态

```bash
systemctl status dcc_04_30
```

### 实时查看应用日志

```bash
journalctl -u dcc_04_30 -f
```

### 查看 Nginx 状态

```bash
systemctl status nginx
```

### 检查 Nginx 配置是否正确

```bash
nginx -t
```
