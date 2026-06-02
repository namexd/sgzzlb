# API 形状

当前版本已有两层实现：

- 小程序本地服务层：`services/api.js`，默认使用本地资料快照和本地评分逻辑。
- Node.js 后端原型：`server/app.js`，默认端口 `8787`，提供同名 HTTP 接口和管理后台接口。

小程序可在“我的 -> 服务端连接”里切换本地快照或远程 API。

## `GET /health`

返回服务健康状态。

## `GET /api/v1/catalog/summary`

返回资料库摘要，包含快照 meta 和各类数量。

## `GET /api/v1/catalog/generals`

对应：`api.getGenerals({ keyword })`

参数：`keyword`、`page`、`pageSize`。

返回武将列表，字段包括 `id`、`name`、`faction`、`cost`、`stats`、`arms`、`tactics`、`asset`。后端 HTTP 版本返回分页结构。

## `GET /api/v1/catalog/tactics`

对应：`api.getTactics({ keyword })`

参数：`keyword`、`page`、`pageSize`。

返回战法列表，字段包括 `id`、`name`、`quality`、`type`、`source`、`sourceGeneral`、`troopLimit`、`description`。后端 HTTP 版本返回分页结构。

## `GET /api/v1/catalog/equipment`

参数：`keyword`、`page`、`pageSize`。

返回装备列表，字段包括 `id`、`name`、`quality`、`type`、`effect`。后端 HTTP 版本返回分页结构。

## `GET /api/v1/catalog/troop-tactics`

参数：`keyword`、`page`、`pageSize`。

返回兵种战法列表，字段与战法类似。后端 HTTP 版本返回分页结构。

## `POST /api/v1/lineups/analyze`

对应：`api.analyzeLineup(payload)`

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

输出 `ScoreReport`：总分、统御、可信度、五维拆解、解释、短板、替代战法和高级订阅提示。

## `GET /api/v1/lineups`

对应：`api.getLineupsAsync({ userId })`

参数：`userId`、`page`、`pageSize`。

返回指定用户保存过的阵容分页列表。当前原型默认用户为 `local-demo`，生产化时必须替换为微信登录态和服务端用户 ID。

## `POST /api/v1/lineups`

对应：`api.saveLineupAsync({ userId, lineup })`

输入：

```json
{
  "userId": "local-demo",
  "lineup": {
    "id": "lineup_123",
    "createdAt": "2026-05-19T10:00:00.000Z",
    "scenario": "PK赛季",
    "troop": "骑兵",
    "score": 82,
    "generals": ["曹操", "刘备", "孙权"],
    "tactics": ["战法A", "战法B"]
  }
}
```

返回写入后的阵容记录。服务端会补齐 `userId`、`updatedAt` 和 `source`。

## `DELETE /api/v1/lineups/:id`

参数：`userId` 可选。

删除指定阵容。当前小程序仅使用本地清空，远程删除接口先保留给后续账号级管理。

## `POST /api/v1/matchups/preview`

对应：`api.previewMatchup({ own, enemy })`

输出本方报告、敌方报告和对位结论。当前是规则预览，不是完整战斗引擎。

## `POST /api/v1/accounts/optimize`

对应：`api.optimizeAccount({ generalIds, tacticIds })`

V1.5 入口。当前只判断库存是否达到三队共存分析门槛。

## `POST /api/v1/battle-reports/import`

对应：`api.importBattleReport({ sourceType })`

V2 入口。当前只保留接口形状。

## 管理后台接口

管理接口统一要求请求头：

```http
x-admin-token: dev-admin-token
```

本地 token 仅用于开发，生产必须替换为正式登录、权限和审计体系。

### `GET /api/admin/dashboard`

返回运营概览：资料数量、规则数量、待审核资产和审计日志摘要。

### `GET /api/admin/rules`

返回评分规则草案。

### `POST /api/admin/rules`

保存评分规则草案。

```json
{
  "rules": [
    {
      "id": "default-score-policy",
      "name": "默认评分策略",
      "enabled": true,
      "description": "复用前端评分规则"
    }
  ]
}
```

### `GET /api/admin/assets/audit`

返回原创卡牌资产审核记录。

### `POST /api/admin/assets/audit`

新增一条资产审核记录。

```json
{
  "targetId": "general_xxx",
  "targetType": "general",
  "status": "approved",
  "note": "人工确认原创风格可用。"
}
```

### `GET /api/admin/audit-log`

返回管理后台操作审计日志。

### `GET /api/admin/lineups`

返回最近保存的阵容样本，供后台观察远程保存链路和真实用户组合分布。

### `GET /api/admin/store/export`

导出当前管理后台 store，包含规则草案、资产审核记录、阵容样本和审计日志。

### `POST /api/admin/store/reset`

重置管理后台 store 为默认状态，并写入一条 `store.reset` 审计日志。
