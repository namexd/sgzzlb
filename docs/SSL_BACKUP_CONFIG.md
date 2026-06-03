# HTTPS 和备份配置完成

## SSL 证书

- **证书状态**: ✅ 已生效
- **域名**: sz.qihangwk.com
- **到期时间**: 2026-09-01
- **自动续费**: 每月 1 日和 15 日凌晨 3:30 自动检查续费

## HTTPS 配置

- **访问地址**: https://sz.qihangwk.com
- **HTTP 跳转**: 自动跳转到 HTTPS
- **TLS 版本**: TLS 1.2 / TLS 1.3
- **安全头**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection

## 数据库备份

- **备份时间**: 每天凌晨 2:30
- **备份路径**: /var/www/sgzzlb/backups/
- **保留时间**: 30 天
- **备份格式**: .sql.gz (压缩)

### 备份文件示例
```
sgzzlb_20260603_100509.sql.gz
```

### 手动备份
```bash
ssh root@47.99.42.50 /var/www/sgzzlb/backup.sh
```

### 恢复备份
```bash
ssh root@47.99.42.50
cd /var/www/sgzzlb/backups
gunzip sgzzlb_20260603_100509.sql.gz
mysql -u sgzzlb -psgzzlb_2026_secure sgzzlb < sgzzlb_20260603_100509.sql
```

## 定时任务汇总

| 任务 | 时间 | 说明 |
|------|------|------|
| SSL 证书续费 | 每月 1,15 日 03:30 | 自动检查并续费 |
| 数据库备份 | 每天 02:30 | 备份并清理 30 天前的备份 |

## 验证命令

```bash
# 测试 HTTPS
curl -I https://sz.qihangwk.com/

# 查看备份
ssh root@47.99.42.50 ls -lh /var/www/sgzzlb/backups/

# 查看定时任务
ssh root@47.99.42.50 cat /etc/cron.d/certbot-renew
ssh root@47.99.42.50 cat /etc/cron.d/sgzzlb-backup
```

---

**配置时间**: 2026-06-03
**状态**: ✅ 完成
