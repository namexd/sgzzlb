#!/bin/bash
set -e

# === 三国志战略版配将分析 - 一键部署脚本 ===
# 使用方法: ./scripts/deploy.sh

SERVER="root@47.99.42.50"
REMOTE_DIR="/var/www/sgzzlb"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== 三国志战略版配将分析 - 部署脚本 ===${NC}"
echo ""

# Step 1: Build frontend
echo -e "${GREEN}[1/5] 构建前端...${NC}"
cd "$LOCAL_DIR/src"
UNI_INPUT_DIR="$LOCAL_DIR/src" ./node_modules/.bin/uni build -p h5
echo -e "${GREEN}✓ 前端构建完成${NC}"

# Step 2: Upload frontend
echo -e "${GREEN}[2/5] 上传前端文件...${NC}"
ssh "$SERVER" "mkdir -p $REMOTE_DIR/frontend"
scp -r "$LOCAL_DIR/src/dist/build/h5/"* "$SERVER:$REMOTE_DIR/frontend/"
echo -e "${GREEN}✓ 前端上传完成${NC}"

# Step 2.5: Build and upload admin
echo -e "${GREEN}[2.5/5] 构建并上传后台管理...${NC}"
cd "$LOCAL_DIR/admin"
npm run build
ssh "$SERVER" "rm -rf $REMOTE_DIR/admin && mkdir -p $REMOTE_DIR/admin"
scp -r dist/* "$SERVER:$REMOTE_DIR/admin/"
echo -e "${GREEN}✓ 后台管理上传完成${NC}"

# Step 3: Upload backend
echo -e "${GREEN}[3/5] 上传后端文件...${NC}"
ssh "$SERVER" "mkdir -p $REMOTE_DIR/backend"
scp "$LOCAL_DIR/server/db.js" "$SERVER:$REMOTE_DIR/backend/"
scp "$LOCAL_DIR/server/app.js" "$SERVER:$REMOTE_DIR/backend/"
scp "$LOCAL_DIR/server/index.js" "$SERVER:$REMOTE_DIR/backend/"
scp "$LOCAL_DIR/server/oss.js" "$SERVER:$REMOTE_DIR/backend/"
scp "$LOCAL_DIR/server/store.js" "$SERVER:$REMOTE_DIR/backend/"
scp "$LOCAL_DIR/server/package.json" "$SERVER:$REMOTE_DIR/backend/"
scp -r "$LOCAL_DIR/utils/"* "$SERVER:$REMOTE_DIR/utils/"
scp -r "$LOCAL_DIR/services/"* "$SERVER:$REMOTE_DIR/services/"
scp "$LOCAL_DIR/data/catalog.js" "$SERVER:$REMOTE_DIR/data/"
scp "$LOCAL_DIR/data/catalog.json" "$SERVER:$REMOTE_DIR/data/"
echo -e "${GREEN}✓ 后端上传完成${NC}"

# Step 4: Install dependencies
echo -e "${GREEN}[4/5] 安装后端依赖...${NC}"
ssh "$SERVER" "cd $REMOTE_DIR/backend && npm install --production"
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# Step 5: Restart services
echo -e "${GREEN}[5/5] 重启服务...${NC}"
ssh "$SERVER" "pm2 restart sgzzlb-server && nginx -s reload"
echo -e "${GREEN}✓ 服务重启完成${NC}"

echo ""
echo -e "${BLUE}=== 部署完成 ===${NC}"
echo -e "前端地址: ${YELLOW}http://sz.qihangwk.com${NC}"
echo -e "后端 API: ${YELLOW}http://sz.qihangwk.com/api/${NC}"
echo -e "健康检查: ${YELLOW}http://sz.qihangwk.com/health${NC}"
