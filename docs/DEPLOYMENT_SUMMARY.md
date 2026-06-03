# 部署状态总结

更新时间：2026-06-03。

## 当前部署链路

项目已经具备两条部署路径：

- 本地脚本：`./scripts/deploy.sh`
- GitHub Actions：`.github/workflows/deploy.yml`

部署内容包括：

- `src` H5 前台构建产物。
- `admin` Vue 后台构建产物。
- `server` 后端代码。
- `utils`、`services` 和 `data` 共享资源。

## 生产入口

- 前台：`https://sz.qihangwk.com`
- 后台：`https://sz.qihangwk.com/admin/`
- 健康检查：`https://sz.qihangwk.com/health`

## 服务器口径

- 服务器：`47.99.42.50`
- 部署目录：`/var/www/sgzzlb`
- 后端端口：`8787`
- 进程管理：PM2
- Web 服务：Nginx
- 数据库：MySQL

真实密码、后台 token、私钥和面板入口不写入此文档。

## 已完成

- 前台 H5、后台、后端分目录部署口径已建立。
- 本地部署脚本会构建前台和后台，并上传后端、共享逻辑和资料快照。
- GitHub Actions 会在 `main` 分支 push 或手动触发时构建并部署。
- 后端支持 `/health` 健康检查。
- 后台支持 `/admin/` 访问。

## 当前待复核

- 本轮未重新执行生产部署。
- 本轮本地 `npm test` 已通过；服务端本地开发和本地测试默认使用 `sgzzlb_local`，生产仍必须显式配置 `MYSQL_*`。
- 需要确认生产环境 `ADMIN_TOKEN`、`TOKEN_SECRET`、`MYSQL_PASSWORD` 已设置为生产级值。
- 需要确认 HTTPS 跳转、微信小程序合法域名和 Nginx 代理配置。
- 需要确认历史文档或提交中如出现真实凭据，是否已经轮换。

## 常用命令

```bash
./scripts/deploy.sh
pm2 status
pm2 logs sgzzlb-server
pm2 restart sgzzlb-server
nginx -t
nginx -s reload
```

## 后续优化

1. 抽查 HTTPS 证书续费和 HTTP 到 HTTPS 跳转。
2. 增加发布后自动冒烟：`/health`、前台首页、后台 dashboard、评分接口、反馈接口。
3. 增加日志轮转，避免 PM2 和 Nginx 日志持续膨胀。
4. 增加数据库自动备份和恢复演练。
5. GitHub Actions 增加测试、前台构建、后台构建、部署和冒烟分阶段状态。
