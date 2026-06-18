#!/bin/bash

# 数据库恢复脚本
# 用法: ./scripts/restore-db.sh <备份文件>

set -e

if [ -z "$1" ]; then
  echo "用法: $0 <备份文件>"
  echo "示例: $0 /var/backups/sgzzlb/sgzzlb_20260604_020000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "错误: 备份文件不存在: $BACKUP_FILE"
  exit 1
fi

# 配置
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-sgzzlb}"

echo "警告: 此操作将覆盖数据库 $MYSQL_DATABASE 的所有数据"
read -p "是否继续? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "操作已取消"
  exit 0
fi

echo "开始恢复数据库 $MYSQL_DATABASE..."

if [ -z "$MYSQL_PASSWORD" ]; then
  gunzip < "$BACKUP_FILE" | mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE"
else
  gunzip < "$BACKUP_FILE" | mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
fi

if [ $? -eq 0 ]; then
  echo "恢复成功"
else
  echo "恢复失败"
  exit 1
fi
