# 三国志战略版配将分析 - 部署文档

## 服务器信息

- **服务器地址**: 47.99.42.50
- **域名**: sz.qihangwk.com
- **操作系统**: CentOS 7
- **Node.js**: v16.20.2 (通过二进制安装)
- **MySQL**: 5.6.50
- **Nginx**: 1.18.0 (宝塔面板)

## 目录结构

```
/var/www/sgzzlb/
├── frontend/          # H5 前端静态文件
├── backend/           # Node.js 后端服务
│   ├── app.js
│   ├── db.js
│   ├── index.js
│   ├── oss.js
│   ├── store.js
│   └── package.json
├── utils/             # 工具函数
├── services/          # 服务层
├── data/              # 数据文件
│   ├── catalog.js
│   └── catalog.json
├── logs/              # 日志目录
└── deploy.sh          # 服务器端部署脚本
```

## 数据库配置

- **数据库名**: sgzzlb
- **用户名**: sgzzlb
- **密码**: sgzzlb_2026_secure
- **主机**: localhost
- **端口**: 3306

## 服务管理

### PM2 命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs sgzzlb-server

# 重启服务
pm2 restart sgzzlb-server

# 停止服务
pm2 stop sgzzlb-server

# 查看监控
pm2 monit
```

### Nginx 命令

```bash
# 测试配置
nginx -t

# 重新加载
nginx -s reload

# 查看日志
tail -f /www/wwwlogs/sz.qihangwk.com.log
```

## 一键部署

### 方法一：本地脚本部署

```bash
# 在项目根目录执行
./scripts/deploy.sh
```

### 方法二：手动部署

1. **构建前端**
```bash
cd src
UNI_INPUT_DIR=$(pwd) ./node_modules/.bin/uni build -p h5
```

2. **上传文件到服务器**
```bash
# 上传前端
scp -r src/dist/build/h5/* root@47.99.42.50:/var/www/sgzzlb/frontend/

# 上传后端
scp server/*.js server/package.json root@47.99.42.50:/var/www/sgzzlb/backend/
scp -r utils/* root@47.99.42.50:/var/www/sgzzlb/utils/
scp -r services/* root@47.99.42.50:/var/www/sgzzlb/services/
scp data/catalog.* root@47.99.42.50:/var/www/sgzzlb/data/
```

3. **服务器上执行**
```bash
ssh root@47.99.42.50
cd /var/www/sgzzlb/backend
npm install --production
pm2 restart sgzzlb-server
nginx -s reload
```

## SSH 密钥认证

已配置 SSH 密钥认证，无需密码即可登录：

```bash
ssh root@47.99.42.50
```

### 添加新用户的 SSH 密钥

1. 获取用户的公钥（通常在 `~/.ssh/id_rsa.pub` 或 `~/.ssh/id_ed25519.pub`）
2. 添加到服务器：
```bash
ssh root@47.99.42.50
echo "用户公钥内容" >> ~/.ssh/authorized_keys
```

## 环境变量

后端服务的环境变量在 PM2 配置文件中设置：

```javascript
// /var/www/sgzzlb/backend/ecosystem.config.js
env: {
  NODE_ENV: 'production',
  PORT: 8787,
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: 3306,
  MYSQL_USER: 'sgzzlb',
  MYSQL_PASSWORD: 'sgzzlb_2026_secure',
  MYSQL_DATABASE: 'sgzzlb'
}
```

## API 接口

- **健康检查**: `GET /health`
- **武将列表**: `GET /api/v1/catalog/generals`
- **战法列表**: `GET /api/v1/catalog/tactics`
- **阵容分析**: `POST /api/v1/lineups/analyze`
- **对位分析**: `POST /api/v1/matchups/preview`

## 故障排查

### 后端服务无法启动

```bash
# 查看错误日志
pm2 logs sgzzlb-server --err

# 检查 MySQL 连接
mysql -u sgzzlb -psgzzlb_2026_secure sgzzlb -e "SELECT 1;"

# 手动测试启动
cd /var/www/sgzzlb/backend
node index.js
```

### 前端无法访问

```bash
# 检查 Nginx 配置
nginx -t

# 检查文件是否存在
ls -la /var/www/sgzzlb/frontend/

# 查看 Nginx 错误日志
tail -f /www/wwwlogs/sz.qihangwk.com.error.log
```

### 数据库问题

```bash
# 登录 MySQL
mysql -u root -pcdcpdKMR8PhdFX4j

# 切换到 sgzzlb 数据库
USE sgzzlb;

# 查看表
SHOW TABLES;

# 查看用户
SELECT * FROM users;
```

## 宝塔面板

- **地址**: http://47.99.42.50:8888/0699de19
- 可以在面板中管理 Nginx、MySQL 等服务

## 安全建议

1. **修改默认密码**: 建议修改 MySQL 和宝塔面板的默认密码
2. **配置 HTTPS**: 可以在宝塔面板中申请 SSL 证书
3. **限制 SSH 登录**: 只允许密钥认证，禁止密码登录
4. **定期备份**: 建议定期备份数据库和重要文件

## 更新日志

- **2026-06-03**: 初始部署，MySQL 数据库，PM2 进程管理
