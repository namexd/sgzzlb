# 项目当前状态

更新时间：2026-06-03。

## 一句话结论

项目已经从“可解释配将评分原型”扩展成前台 H5/小程序、Node 后端、Vue 管理后台和生产部署链路并存的产品雏形。当前最大问题不是页面数量不足，而是文档漂移、阵容数据存在 `.runtime` 与 MySQL 双存储边界，以及生产配置和远程同步链路仍需收口。

## 本轮读盘范围

已查看：

- 根目录 README、设计、架构、API、部署、资产文档。
- `src/` UniApp 页面、服务适配和核心工具。
- `server/` HTTP 路由、MySQL 数据访问、运行时 store 和 OSS 上传。
- `admin/` Vue 管理后台路由、接口适配和页面清单。
- `tests/` 现有测试入口和本轮 `npm test` 输出。
- 最近提交记录和当前工作区未提交状态。

本轮改动：

- 修复本地 MySQL 默认连接、数据库自动创建和服务端停止时关闭连接池。
- 修正服务端资料摘要测试里过期的战法数量断言。
- 修复 UniApp H5 构建脚本的输入目录口径，并纳入 H5 favicon 资源。
- 未纳入与部署无直接关系的 `CLAUDE.md` 和源图文件。

## 已完成能力

### 前台

- 评分页：场景、兵种、三武将、六战法、红度、评分报告、维度解释、短板和替代战法。
- 搜索选择器：武将和战法支持搜索弹层选择。
- 资料页：武将、战法、装备、兵种资料搜索和分页加载。
- 抽卡页：赛季、保底条、日历、快速记录、手动记录、统计入口。
- 对位页：环境模板或已保存阵容对位，支持战斗结果记录和战报统计。
- 我的页：登录状态、订阅切换、保存阵容、抽卡统计、账号级共存分析和同步入口。
- 登录页：用户名/密码登录和注册。
- 反馈页：中文内容校验、无意义文本拦截、敏感词拦截和远程提交。

### 后端

- 资料、评分、对位、账号优化基础接口。
- 用户注册、登录、微信登录、匿名登录、profile 和权益接口。
- MySQL 表：`users`、`draw_pools`、`draw_records`、`lineups`、`battle_reports`、`feedback`。
- 抽卡池、抽卡记录、战报、反馈的 MySQL 读写。
- `.runtime` 管理后台 store：规则草案、资产审核、审计日志和部分阵容样本。
- 管理接口：dashboard、rules、assets audit、audit log、lineups、store export/reset、cards upload。
- OSS 上传封装。

### 管理后台

- Vue 3 + Element Plus 管理端。
- 后台 token 登录。
- 页面：仪表盘、意见反馈、阵容管理、资料数据、评分规则、审计日志。
- 通过 `VITE_API_BASE` 连接后端，默认本地 `http://127.0.0.1:8787`。

### 部署

- `scripts/deploy.sh`：构建 H5、构建后台、上传后端和数据、重启服务。
- `.github/workflows/deploy.yml`：push 到 `main` 或手动触发后构建并部署。
- 生产目录口径为 `/var/www/sgzzlb`，前台、后台、后端分目录部署。

## 当前验证状态

本轮执行：

```bash
npm test
npm run build:h5      # src/
npm run build         # admin/
```

结果：

- `tests/catalog.test.mjs` 通过。
- `tests/scoring.test.mjs` 通过。
- `tests/server.test.mjs` 通过。
- `tests/drawStorage.test.mjs` 通过。
- `src/` H5 构建通过。
- `admin/` 生产构建通过；仅有依赖注释和 chunk 体积警告。

当前结论：

- 本地 MySQL 已确认可用，后端未设置 `MYSQL_USER` 时默认使用 `root` 空密码连接本机 MySQL。
- 本地开发和本地测试默认库是 `sgzzlb_local`，不存在时会自动创建数据库和表。
- 服务端停止时会关闭 MySQL 连接池，测试命令可正常退出。
- 本轮没有跑微信小程序构建。

## 当前工作区状态

读盘前已有未提交内容：

- `CLAUDE.md`：未跟踪协作规则文件。
- `images/icons/图标logo.png`：未跟踪图片。

本轮将 favicon 引用和 `src/static/logo.png` 纳入部署提交；`CLAUDE.md` 与 `images/icons/图标logo.png` 暂不纳入。

## 主要风险

- 阵容远程数据存在双存储：`.runtime` store 与 MySQL 并存且读写入口不一致。
- H5 远程登录态请求需要复核 CORS 是否允许 `authorization` 请求头。
- 资料页数量摘要需要复核异步接口返回是否被正确等待。
- 部署文档历史上存在明文凭据口径，生产凭据需要确认是否轮换。
- 后台 token 登录不是正式管理员账号体系。
- 前台抽卡页主体仍以本地存储为主，远程同步链路需要真实端到端验收。

## 建议下一步

优先级从高到低：

1. 统一阵容读写存储，优先改为 MySQL，并让前台、后台和同步接口读同一份数据。
2. 修正 H5 远程模式的 CORS、登录态和 profile/同步链路。
3. 跑一次真实页面冒烟，确认 H5 和后台部署后的接口连通。
4. 处理部署密钥和历史凭据风险，补环境变量示例但不写真实值。
5. 继续扩服务端测试，覆盖登录、抽卡、战报和反馈的 MySQL 链路。
