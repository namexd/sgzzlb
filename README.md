# 三国志战略版配将分析小程序

面向《三国志战略版》活跃中高战玩家的配将分析工具。产品核心是“可解释阵容评分”：不只给分数，还给维度拆解、短板、对位风险和替代战法。

## 当前仓库状态

当前已经从早期原生小程序原型演进为三段式工程：

- `src/`：UniApp 前台，支持 H5 和微信小程序构建。页面包含评分、资料、抽卡、对位、我的、登录、反馈。
- `server/`：Node.js HTTP 后端，提供资料、评分、阵容、对位、账号、抽卡、战报、反馈和管理接口。
- `admin/`：Vue 3 + Element Plus 管理后台，覆盖仪表盘、意见反馈、阵容管理、资料数据、评分规则和审计日志。
- `data/`、`utils/`、`services/`：前后端共享的数据快照、评分逻辑、资料查询和本地服务适配。
- `docs/`：架构、API、部署、资产策略、当前状态和后续路线。

截至 2026-06-03，已落地的主要能力：

- 可解释阵容评分：赛季/场景、兵种、三武将、六战法、红度、评分报告、短板和替代战法。
- 搜索优先选择器：武将和战法选择不再依赖长列表滚动。
- 资料库检索：武将、战法、装备、兵种四类资料，保留文字字段和原创资产状态。
- 抽卡日历：赛季、保底、每日记录、快速记录和统计页。
- 对位预览：环境模板或已保存阵容对比，并支持记录战斗结果和查看战报统计。
- 账号与同步：登录/注册、本地保存、远程 API 模式、阵容/抽卡同步入口。
- 意见反馈：前台提交，后台列表和状态流转。
- 管理后台：运营概览、反馈、阵容、资料、规则、审计。
- 部署链路：本地脚本和 GitHub Actions 构建 H5、后台和后端，并推送到生产服务器。

更详细的当前读盘结论见 `docs/PROJECT_STATUS.md`，后续计划见 `docs/ROADMAP.md`。

## 常用命令

根目录命令：

```bash
npm run fetch:data
npm run dev:server
npm test
```

前台 UniApp：

```bash
cd src
npm run dev:h5
npm run dev:mp-weixin
npm run build:h5
npm run build:mp-weixin
```

管理后台：

```bash
cd admin
npm run dev
npm run build
```

服务端生产化运行需要通过环境变量提供配置，至少包括：

- `ADMIN_TOKEN`
- `TOKEN_SECRET`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

涉及微信登录和 OSS 上传时，还需要 `WX_APPID`、`WX_SECRET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_BUCKET` 等配置。凭据不得写入仓库文档或提交记录。

变量清单可参考 `.env.example`。项目不会自动加载该文件，需要由 shell、PM2、CI 或部署平台注入环境变量。

数据库配置分两类：

- 本地开发和本地测试：未设置 `MYSQL_USER` 时，后端默认使用 Homebrew 常见的 `root` 空密码连接本机 MySQL，并在 `sgzzlb_local` 数据库不存在时自动创建；服务端测试也固定使用这套本地库。
- 生产环境：必须显式配置 `MYSQL_*`，不能依赖本地默认值。

## 本地打开方式

- H5 前台：在 `src/` 执行 `npm run dev:h5` 后按终端输出访问本地地址。
- 微信小程序：在 `src/` 执行 `npm run dev:mp-weixin` 或 `npm run build:mp-weixin`，再用微信开发者工具打开 `src/dist/dev/mp-weixin` 或对应构建目录。
- 后端：根目录执行 `npm run dev:server`，默认监听 `127.0.0.1:8787`。
- 管理后台：在 `admin/` 执行 `npm run dev`。如需连接远程后端，设置 `VITE_API_BASE`。

## 数据和资产边界

`scripts/fetch-official-catalog.mjs` 抓取官方公开资料库接口，生成 `data/catalog.json` 和 `data/catalog.js`。脚本会剔除官方图片 URL，只保留文字字段和原创资产状态。

当前可展示原创卡牌图和 OSS 图，但不得引用官网图片、游戏立绘、竞品截图或官方卡牌边框。资产策略见 `docs/ASSET_POLICY.md`。

## 当前验证结论

本轮修复后执行过 `npm test`：

- `tests/catalog.test.mjs` 通过。
- `tests/scoring.test.mjs` 通过。
- `tests/server.test.mjs` 通过。
- `tests/drawStorage.test.mjs` 通过。

服务端测试仍会提示 `TOKEN_SECRET` 未设置，这是本地开发使用默认签名密钥的提醒；生产环境必须配置真实值。
