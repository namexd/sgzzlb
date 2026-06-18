# API 形状

更新时间：2026-06-03。

当前后端入口是 `server/app.js`，默认监听 `127.0.0.1:8787`。前台通过 `src/services/api.js` 在本地模式和远程模式之间切换；管理后台通过 `admin/src/api/index.js` 调用后端。

## 通用约定

- 普通 JSON 请求使用 `content-type: application/json`。
- 登录态请求使用 `authorization: Bearer <token>`。
- 管理接口使用 `x-admin-token: <ADMIN_TOKEN>`。
- 生产环境必须设置 `ADMIN_TOKEN`、`TOKEN_SECRET` 和 MySQL 环境变量。

## 健康检查

### `GET /health`

返回服务健康状态、运行时长和时间戳。

## 账号与权益

### `POST /api/v1/auth/register`

用户名/密码注册。用户名至少 3 个字符，只允许字母、数字和下划线；密码至少 6 个字符。

### `POST /api/v1/auth/login`

用户名/密码登录，返回 token 和用户信息。

### `POST /api/v1/auth/wechat-login`

微信小程序登录。生产环境需要 `WX_APPID` 和 `WX_SECRET`；缺少时使用开发兜底 openid。

### `POST /api/v1/auth/anonymous-login`

H5 匿名登录，返回 token。

### `GET /api/v1/auth/profile`

需要 Bearer token。返回用户、保存阵容数、抽卡记录数和权益。

### `GET /api/v1/auth/entitlements`

返回当前登录用户权益；未登录时返回免费层权益。

### `POST /api/v1/auth/set-tier`

需要 `x-admin-token`。用于调整指定用户的 `free`/`premium` 权益。

## 资料库

### `GET /api/v1/catalog/summary`

返回资料快照摘要，包含武将、战法、装备、兵种数量和快照元信息。

### `GET /api/v1/catalog/generals`

参数：`keyword`、`page`、`pageSize`。

返回分页武将列表。

### `GET /api/v1/catalog/tactics`

参数：`keyword`、`page`、`pageSize`。

返回分页战法列表。

### `GET /api/v1/catalog/equipment`

参数：`keyword`、`page`、`pageSize`。

返回分页装备列表。

### `GET /api/v1/catalog/troop-tactics`

参数：`keyword`、`page`、`pageSize`。

返回分页兵种战法列表。

## 阵容与评分

### `POST /api/v1/lineups/analyze`

输入：

```json
{
  "scenario": "pk",
  "troop": "骑兵",
  "generalIds": ["..."],
  "tacticIds": ["..."],
  "redLevels": [0, 0, 0]
}
```

输出评分报告：总分、场景、兵种、可信度、统御、校验项、维度拆解、解释、短板和替代战法。

### `GET /api/v1/lineups`

参数：`userId`、`page`、`pageSize`。

当前读取 `.runtime` store 中的阵容样本。注意：这与 `/api/v1/lineups/sync` 的 MySQL 存储不是同一份数据，下一轮需要统一。

### `POST /api/v1/lineups`

保存阵容到 `.runtime` store。

### `DELETE /api/v1/lineups/:id`

删除 `.runtime` store 中的阵容样本。

### `POST /api/v1/lineups/sync`

批量同步本地阵容到 MySQL。当前根据请求用户写入 MySQL，但读取链路尚未统一到 MySQL。

## 对位与账号优化

### `POST /api/v1/matchups/preview`

输入本方和敌方阵容，输出双方评分和对位结论。当前仍是规则预览，不是完整战斗引擎。

### `POST /api/v1/accounts/optimize`

输入账号库存，输出 V1.5 共存阵容建议、战法冲突和剩余库存。

## 战报

### `POST /api/v1/battle-reports`

写入一条战斗结果。`result` 必须是 `win`、`loss` 或 `draw`。

### `GET /api/v1/battle-reports`

参数：`limit`、`offset`。

返回当前用户战报列表。

### `GET /api/v1/battle-reports/stats`

返回当前用户战报统计，包括总场次、胜负平、胜率、平均战损、兵种对位和最近趋势。

### `DELETE /api/v1/battle-reports/:id`

删除当前用户的一条战报。

### `POST /api/v1/battle-reports/import`

保留的战报导入接口形状。

## 意见反馈

### `POST /api/v1/feedback`

提交反馈。内容 5 到 1000 字，联系方式最多 128 字。

### `GET /api/v1/feedback`

需要 `x-admin-token`。返回反馈列表。

### `PUT /api/v1/feedback/:id/status`

需要 `x-admin-token`。状态必须是 `pending`、`read`、`resolved` 或 `rejected`。

## 抽卡

### `GET /api/v1/draw-pools`

返回当前用户卡池。

### `POST /api/v1/draw-pools`

创建卡池。

### `DELETE /api/v1/draw-pools/:id`

删除卡池，并删除该卡池下的抽卡记录。

### `GET /api/v1/draw-records`

参数：`poolId` 可选。

返回当前用户抽卡记录；指定 `poolId` 时只返回该卡池记录。

### `POST /api/v1/draw-records`

写入抽卡记录。

### `DELETE /api/v1/draw-records/:id`

删除抽卡记录。

### `POST /api/v1/draw-records/sync`

批量同步本地抽卡记录到 MySQL。

## 管理后台

以下接口均需要 `x-admin-token`。

### `GET /api/admin/dashboard`

返回运营概览。

### `GET /api/admin/rules`

返回评分规则草案。

### `POST /api/admin/rules`

保存评分规则草案。

### `GET /api/admin/assets/audit`

返回原创资产审核记录。

### `POST /api/admin/assets/audit`

新增资产审核记录。

### `GET /api/admin/audit-log`

返回审计日志。

### `GET /api/admin/lineups`

返回最近阵容样本。

### `GET /api/admin/store/export`

导出 `.runtime` 管理后台 store。

### `POST /api/admin/store/reset`

重置 `.runtime` 管理后台 store。

### `POST /api/admin/cards/upload`

上传卡牌图片到 OSS。需要 multipart 文件和 OSS 环境变量。

## 当前接口风险

- H5 使用 Bearer token 时，CORS 允许头需要包含 `authorization`。
- 阵容接口的 `.runtime` 与 MySQL 存储来源必须统一。
- 后端创建 app 时会初始化 MySQL；本地开发和本地测试默认使用 `root` 空密码并自动创建 `sgzzlb_local` 数据库，生产环境必须显式设置 `MYSQL_*`。
- 后台 token 登录不是完整管理员账号系统，生产化前需要正式认证与权限。

## 配将推荐规划

配将功能一期优先复用现有账号优化能力，不新增破坏性接口。

### `POST /api/v1/accounts/optimize`

当前接口可作为一期“智能配将建议”的基础：输入用户拥有的武将和战法，输出最多 3 套共存阵容、战法冲突、未使用库存和评分解释。后续产品化时，前台可以把该接口包装为“配将推荐”。

后续兼容扩展字段建议：

```js
{
  generalIds: ["..."],
  tacticIds: ["..."],
  targetLineupCount: 3,
  season: "pk",
  catalogVersionId: "cv_...",
  options: {
    lockedGeneralIds: [],
    excludedGeneralIds: [],
    lockedTacticIds: [],
    excludedTacticIds: [],
    preferredTroop: "",
    strategyPreference: "balanced"
  }
}
```

后续如果新增专用接口，建议命名为 `POST /api/v1/lineups/recommend`，但内部仍复用 `utils/optimizer.js` 和 `utils/scoring.js`，并保持 `POST /api/v1/accounts/optimize` 兼容。

配将推荐响应必须包含 `catalogContext`，并在接入战报模拟复核时展示 `ruleCoverage` 与 `assumptions`，避免把估算结果包装成官方结论。

