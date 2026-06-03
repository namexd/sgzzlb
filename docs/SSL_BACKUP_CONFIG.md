# HTTPS 和备份配置

更新时间：2026-06-03。

## HTTPS 状态

- 域名：`sz.qihangwk.com`
- HTTPS 地址：`https://sz.qihangwk.com`
- HTTP 跳转：应自动跳转到 HTTPS。
- TLS 版本：TLS 1.2 / TLS 1.3。
- 安全头：建议保留 `X-Frame-Options`、`X-Content-Type-Options`、`X-XSS-Protection`。
- 证书自动续费：按服务器定时任务执行，需定期抽查。

## 数据库备份

- 备份时间：每天凌晨 2:30。
- 备份路径：`/var/www/sgzzlb/backups/`。
- 保留时间：30 天。
- 备份格式：`.sql.gz`。

备份文件示例：

```text
sgzzlb_20260603_100509.sql.gz
```

## 手动备份

```bash
ssh root@47.99.42.50 /var/www/sgzzlb/backup.sh
```

## 恢复备份

恢复前必须确认目标库、备份时间点和影响范围。数据库密码不得写入命令历史，推荐从安全环境变量或交互输入读取。

```bash
ssh root@47.99.42.50
cd /var/www/sgzzlb/backups
gunzip sgzzlb_YYYYMMDD_HHMMSS.sql.gz
MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE" < sgzzlb_YYYYMMDD_HHMMSS.sql
```

如服务器没有导出 `MYSQL_PASSWORD`、`MYSQL_USER`、`MYSQL_DATABASE`，应先从 PM2 配置或密钥管理系统读取，不要把真实值写进文档。

## 定时任务汇总

| 任务 | 时间 | 说明 |
|------|------|------|
| SSL 证书续费 | 每月 1、15 日 03:30 | 自动检查并续费 |
| 数据库备份 | 每天 02:30 | 备份并清理 30 天前的备份 |

## 验证命令

```bash
curl -I https://sz.qihangwk.com/
ssh root@47.99.42.50 ls -lh /var/www/sgzzlb/backups/
ssh root@47.99.42.50 cat /etc/cron.d/certbot-renew
ssh root@47.99.42.50 cat /etc/cron.d/sgzzlb-backup
```

## 待复核

- 证书到期时间和自动续费任务是否仍有效。
- 备份任务是否按计划生成新文件。
- 至少完成一次恢复演练，确认备份可用。
- 如果历史文档或提交中出现真实数据库密码，应立即轮换。
