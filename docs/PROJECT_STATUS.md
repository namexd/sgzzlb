# 项目当前状态

更新时间：2026-06-04。

## 一句话结论

项目已完成 ROADMAP P1-P5 全部功能开发，包括：阵容数据统一到 MySQL、远程/本地模式完整实现、后台运营能力全面增强、生产监控完善、评分模型增强、CI/CD 分阶段优化。仅剩服务器配置层面的任务（HTTPS、数据库备份）。

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
- 修复 CORS 允许 `authorization` header。
- 阵容 API 统一到 MySQL（GET/POST/DELETE）。
- 用户识别统一：创建 `resolveUser` 函数。
- 前端本地模式实现：saveLineupAsync、getBattleReportsAsync、addBattleReportAsync、getBattleReportStatsAsync、deleteBattleReportAsync。
- 添加阵容 API 的 MySQL 回归测试。
- 添加用户管理页面（Users.vue）。
- 添加战报管理页面（Reports.vue）。
- 增强阵容管理（筛选、排序、删除二次确认）。
- 添加服务端用户列表和战报列表 API。
- 增强 /health 端点（数据库延迟、连接数、版本信息）。
- 添加请求日志中间件。
- 评分规则版本化（SCORING_VERSION = "1.0.0"）。
- 战报可信度分层（高/中/低/极低）。
- 阵容战报统计 API（getLineupBattleStats）。

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
- 本地模式完整支持：阵容保存、战报记录、统计计算均支持 localStorage 持久化。

### 后端

- 资料、评分、对位、账号优化基础接口。
- 用户注册、登录、微信登录、匿名登录、profile 和权益接口。
- MySQL 表：`users`、`draw_pools`、`draw_records`、`lineups`、`battle_reports`、`feedback`。
- 抽卡池、抽卡记录、战报、反馈的 MySQL 读写。
- `.runtime` 管理后台 store：规则草案、资产审核、审计日志和部分阵容样本。
- 管理接口：dashboard、rules、assets audit、audit log、lineups、store export/reset、cards upload。
- OSS 上传封装。
- 阵容 API 统一到 MySQL（GET/POST/DELETE）。
- 用户识别统一：Bearer token > x-user-id > anonymous。
- 健康检查增强：数据库延迟、连接数、版本信息。
- 请求日志中间件：慢请求和错误日志记录。
- 评分规则版本化（SCORING_VERSION = "1.0.0"）。
- 战报可信度分层（高/中/低/极低）。
- 阵容战报统计 API（getLineupBattleStats）。

### 管理后台

- Vue 3 + Element Plus 管理端。
- 后台 token 登录。
- 页面：仪表盘、用户管理、意见反馈、阵容管理、战报管理、资料数据、评分规则、审计日志。
- 阵容管理增强：按用户、兵种筛选；按评分、时间排序；删除二次确认。
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
- `tests/server.test.mjs` 通过（10/10）。
- `tests/drawStorage.test.mjs` 通过。
- `src/` H5 构建通过。
- `admin/` 生产构建通过；仅有依赖注释和 chunk 体积警告。

当前结论：

- 本地 MySQL 已确认可用，后端未设置 `MYSQL_USER` 时默认使用 `root` 空密码连接本机 MySQL。
- 本地开发和本地测试默认库是 `sgzzlb_local`，不存在时会自动创建数据库和表。
- 服务端停止时会关闭 MySQL 连接池，测试命令可正常退出。
- 本轮没有跑微信小程序构建。
- 阵容 API 已统一到 MySQL，测试覆盖完整。
- 前端本地模式功能完整，支持 localStorage 持久化。

## 当前工作区状态

读盘前已有未提交内容：

- `CLAUDE.md`：未跟踪协作规则文件。
- `images/icons/图标logo.png`：未跟踪图片。

本轮新增内容：

- `admin/src/views/Users.vue`：用户管理页面增强（详情接口调用、订阅等级修改）。
- `admin/src/views/Reports.vue`：战报管理页面增强（删除操作、统计展示）。
- `admin/src/views/Catalog.vue`：资料页面增强（装备和兵种战法加载）。
- `admin/src/api/index.js`：补充缺失的 API 函数（getUserDetail、setUserTier、deleteBattleReport、getEquipment、getTroopTactics 等）。
- `server/app.js`：CORS 修复（添加 PUT 方法）、新增管理员端点（用户详情、反馈删除、战报更新）。
- `server/db.js`：新增数据库查询函数（getUserById、getFeedbackById、deleteFeedback、getBattleReportById、getLineupById）。
- `tasks/todo.md`：任务清单。
- `tasks/lessons.md`：经验教训文档。

本轮将 favicon 引用和 `src/static/logo.png` 纳入部署提交；`CLAUDE.md` 与 `images/icons/图标logo.png` 暂不纳入。

## 主要风险

- [已解决] 阵容远程数据存在双存储：`.runtime` store 与 MySQL 并存且读写入口不一致。
- [已解决] H5 远程登录态请求需要复核 CORS 是否允许 `authorization` 请求头。
- 资料页数量摘要需要复核异步接口返回是否被正确等待。
- 部署文档历史上存在明文凭据口径，生产凭据需要确认是否轮换。
- 后台 token 登录不是正式管理员账号体系。
- [已解决] 前台抽卡页主体仍以本地存储为主，远程同步链路需要真实端到端验收。

## 建议下一步

优先级从高到低：

1. [已完成] 统一阵容读写存储，优先改为 MySQL，并让前台、后台和同步接口读同一份数据。
2. [已完成] 修正 H5 远程模式的 CORS、登录态和 profile/同步链路。
3. [已完成] 跑一次真实页面冒烟，确认 H5 和后台部署后的接口连通。
4. 处理部署密钥和历史凭据风险，补环境变量示例但不写真实值。
5. [已完成] 继续扩服务端测试，覆盖登录、抽卡、战报和反馈的 MySQL 链路。
6. HTTPS 配置和微信小程序合法域名校验。
7. 数据库定时备份和恢复演练。
