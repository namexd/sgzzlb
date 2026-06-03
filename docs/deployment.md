# 三国志战略版配将分析部署文档

更新时间：2026-06-03。

## 生产环境口径

- 服务器：`47.99.42.50`
- 域名：`sz.qihangwk.com`
- 操作系统：CentOS 7
- 后端端口：`8787`
- Web 服务：Nginx
- 进程管理：PM2
- 数据库：MySQL
- 部署目录：`/var/www/sgzzlb`

真实数据库密码、后台 token、SSH 私钥、宝塔面板入口和 OSS 密钥不得写入仓库文档。它们应保存在服务器环境变量、PM2 配置、GitHub Actions Secrets 或其它密钥管理系统中。

## 目录结构

```text
/var/www/sgzzlb/
├── frontend/          # H5 前台静态文件
├── admin/             # 管理后台静态文件
├── backend/           # Node.js 后端服务
├── utils/             # Node 侧共享工具
├── services/          # Node 侧服务适配
├── data/              # 资料快照
└── logs/              # 日志目录
```

## 必需环境变量

后端至少需要：

```bash
ADMIN_TOKEN=
TOKEN_SECRET=
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
```

可选能力需要：

```bash
WX_APPID=
WX_SECRET=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=
OSS_ENDPOINT=
OSS_PREFIX=
OSS_CDN_DOMAIN=
```

`TOKEN_SECRET` 和 `ADMIN_TOKEN` 必须使用生产级随机值；`MYSQL_PASSWORD` 不允许为空。

## 本地一键部署

在项目根目录执行：

```bash
./scripts/deploy.sh
```

脚本会依次执行：

1. 构建 `src` H5 前台。
2. 上传前台静态文件。
3. 构建并上传 `admin` 后台。
4. 上传 `server`、`utils`、`services` 和 `data`。
5. 在服务器安装后端生产依赖。
6. 重启 PM2 服务并 reload Nginx。

## GitHub Actions 部署

`.github/workflows/deploy.yml` 支持：

- push 到 `main` 自动触发。
- `workflow_dispatch` 手动触发。

CI 会构建前台 H5、构建后台、通过 SSH 上传文件，并在服务器执行后端依赖安装和服务重启。需要在 GitHub Secrets 中配置部署私钥，不能把私钥写入仓库。

## 手动部署

### 构建前台

```bash
cd src
UNI_INPUT_DIR=$(pwd) ./node_modules/.bin/uni build -p h5
```

### 构建后台

```bash
cd admin
npm run build
```

### 上传文件

```bash
scp -r src/dist/build/h5/* root@47.99.42.50:/var/www/sgzzlb/frontend/
scp -r admin/dist/* root@47.99.42.50:/var/www/sgzzlb/admin/
scp server/*.js server/package.json root@47.99.42.50:/var/www/sgzzlb/backend/
scp -r utils/* root@47.99.42.50:/var/www/sgzzlb/utils/
scp -r services/* root@47.99.42.50:/var/www/sgzzlb/services/
scp data/catalog.js data/catalog.json root@47.99.42.50:/var/www/sgzzlb/data/
```

### 重启服务

```bash
ssh root@47.99.42.50
cd /var/www/sgzzlb/backend
npm install --omit=dev
pm2 restart sgzzlb-server
nginx -s reload
```

## 常用运维命令

```bash
pm2 status
pm2 logs sgzzlb-server
pm2 restart sgzzlb-server
nginx -t
nginx -s reload
```

## 访问地址

- 前台：`https://sz.qihangwk.com`
- 后台：`https://sz.qihangwk.com/admin/`
- 健康检查：`https://sz.qihangwk.com/health`

HTTP 地址只作为跳转或兼容入口；微信小程序合法域名应配置 HTTPS 域名。

## 故障排查

### 后端无法启动

```bash
pm2 logs sgzzlb-server --err
cd /var/www/sgzzlb/backend
node index.js
```

重点检查：

- `MYSQL_PASSWORD` 是否为空。
- `ADMIN_TOKEN` 是否设置。
- `TOKEN_SECRET` 是否仍为默认值。
- MySQL 用户是否有目标库权限。

### 前台或后台无法访问

```bash
nginx -t
ls -la /var/www/sgzzlb/frontend/
ls -la /var/www/sgzzlb/admin/
```

重点检查：

- 前台构建目录是否上传到 `frontend/`。
- 后台构建目录是否上传到 `admin/`。
- Nginx 是否把 `/api/` 代理到后端，把 `/admin/` 指到后台静态目录。

### 接口跨域或登录态异常

重点检查：

- H5 请求是否带 `authorization`。
- Nginx 或后端 CORS 是否允许 `authorization` 请求头。
- 前台 `VITE_API_BASE` 或运行时 API baseUrl 是否指向生产域名。

## 发布后冒烟

每次发布后至少检查：

- `GET /health`
- 前台首页可打开。
- 管理后台 `/admin/` 可打开。
- 管理后台 token 能访问 dashboard。
- 评分页能生成报告。
- 反馈提交能写入后端。

## 安全要求

- 不在仓库内保存真实密码、token、私钥或面板入口。
- 如果历史提交中出现真实凭据，必须轮换。
- SSH 只使用密钥认证。
- MySQL、PM2、Nginx 日志需要定期轮转。
- 数据库需要定期备份并演练恢复。
