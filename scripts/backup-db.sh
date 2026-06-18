#!/bin/bash

# 数据库备份脚本
# 用法: ./scripts/backup-db.sh [备份目录]
# 建议添加到 cron: 0 2 * * * /path/to/scripts/backup-db.sh

set -e

# 配置
BACKUP_DIR="${1:-/var/backups/sgzzlb}"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-sgzzlb}"
RETENTION_DAYS=7

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${MYSQL_DATABASE}_${DATE}.sql.gz"

# 执行备份
echo "开始备份数据库 $MYSQL_DATABASE..."
if [ -z "$MYSQL_PASSWORD" ]; then
  mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" | gzip > "$BACKUP_FILE"
else
  mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" | gzip > "$BACKUP_FILE"
fi

# 检查备份是否成功
if [ $? -eq 0 ]; then
  echo "备份成功: $BACKUP_FILE"
  echo "备份大小: $(du -h "$BACKUP_FILE" | cut -f1)"
else
  echo "备份失败"
  exit 1
fi

# 清理旧备份
echo "清理 $RETENTION_DAYS 天前的备份..."
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "备份完成"
