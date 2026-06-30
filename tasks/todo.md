# 任务清单

更新时间：2026-06-18

## P1：统一阵容数据存储

- [x] 1.1 修复 CORS 允许 `authorization` header
- [x] 1.2 将 `GET /api/v1/lineups` 改为读取 MySQL
- [x] 1.3 将 `POST /api/v1/lineups` 改为写入 MySQL
- [x] 1.4 将 `DELETE /api/v1/lineups/:id` 改为删除 MySQL 数据
- [x] 1.5 添加阵容 API 回归测试
- [x] 1.6 运行测试验证

## P2：远程模式修复

- [x] 2.1 统一 `x-user-id`、Bearer token 和匿名用户规则
- [x] 2.2 前端 `saveLineupAsync` 本地模式实现 localStorage 持久化
- [x] 2.3 前端 `getBattleReportsAsync` 本地模式实现
- [x] 2.4 前端 `addBattleReportAsync` 本地模式实现
- [x] 2.5 前端 `getBattleReportStatsAsync` 本地模式实现

## P3：后台运营能力

- [x] 3.1 添加用户管理页面（用户列表、筛选、详情）
- [x] 3.2 添加战报管理页面（战报列表、筛选）
- [x] 3.3 增强阵容管理（筛选、排序、删除二次确认）
- [x] 3.4 添加服务端用户列表 API
- [x] 3.5 添加服务端战报列表 API
- [x] 3.6 增强规则管理（版本号、灰度对象、回滚）

## P4：生产部署和监控

- [x] 4.1 添加 /health 端点的详细状态信息
- [x] 4.2 添加数据库连接池状态检查
- [x] 4.3 添加请求日志中间件
- [x] 4.4 更新部署文档
- [x] 4.5 增强 GitHub Actions（测试、构建、部署分阶段）

## P5：评分和战报模型增强

- [x] 5.1 评分规则版本化（SCORING_VERSION）
- [x] 5.2 战报可信度分层（高/中/低/极低）
- [x] 5.3 阵容战报统计 API（getLineupBattleStats）
- [x] 5.4 评分报告添加 battleStats 字段
- [x] 5.5 高级订阅能力扩展（深度解释、替代战法、保存阵容、对位次数）

## P6：战报模拟器 MVP

- [x] 6.1 编写战报模拟器规格文档
- [x] 6.2 新增服务端模拟器核心模块
- [x] 6.3 添加 `POST /api/v1/battles/simulate` 接口
- [x] 6.4 将模拟指标并列接入评分报告
- [x] 6.5 在对位页增加战报模拟入口
- [x] 6.6 添加模拟器单测和 API 回归测试
- [x] 6.7 运行自动化测试和前端构建验证
- [ ] 6.8 浏览器手动点验对位页模拟入口（当前会话无浏览器自动化工具）

## P7：战报模拟器深化开发

- [x] 7.1 扩展战报模拟器持续开发规格
- [x] 7.2 深化状态系统：连击、规避、洞察、抵御、会心/奇谋、持续伤害、急救/休整
- [x] 7.3 扩展战法规则辅助函数和显式规则注册表
- [x] 7.4 支持缘分、装备、属性加点等阵容输入维度
- [x] 7.5 增强战报 highlights、ruleCoverage、稳定性原因和关键样本
- [x] 7.6 增强对位页模拟参数配置和解释展示
- [x] 7.7 补充单测、API 回归测试和构建验证
- [x] 7.8 部署到服务器域名并验证线上效果

## P8：赛季资料与规则更新系统

- [x] 8.1 更新赛季资料、版本化、导入审核和规则覆盖规格
- [x] 8.2 新增资料版本、导入任务、规则待办存储层
- [x] 8.3 改造 catalog 读取为 season/version 感知并保持默认兼容
- [x] 8.4 新增后台导入、审核、发布、丢弃和规则待办 API
- [x] 8.5 新增后台“赛季资料”页面和 API 适配
- [x] 8.6 模拟器支持按 season/catalogVersionId 解析资料并输出 catalogContext
- [x] 8.7 增加战法规则 metadata、覆盖分类和待办生成
- [x] 8.8 用户端模拟弹窗增加赛季选择和战法级覆盖展示
- [x] 8.9 补充 catalog diff、server、simulator 测试
- [x] 8.10 运行测试、构建、本地冒烟、部署并线上验证

## P9：官方公开资料自动采集、入口视觉统一与评分增强

- [x] 9.1 更新官方公开资料采集、入口视觉、tab 统一和评分增强规格
- [x] 9.2 新增服务端官方公开资料采集模块并改造手动脚本复用
- [x] 9.3 新增后台官方采集 API、无差异跳过和可配置定时采集
- [x] 9.4 增强后台“赛季资料”页面的官方采集入口和结果提示
- [x] 9.5 强化用户端对位页“战报模拟”入口
- [x] 9.6 统一底部 tab 图标、色值、尺寸和 H5 展示样式
- [x] 9.7 数据库资料版本优先，评分模型接入资料版本、规则覆盖、模拟摘要和可信度解释
- [x] 9.8 补充采集、评分、服务端回归测试并运行完整验证
- [x] 9.9 构建 H5 和后台管理端并完成本地冒烟
- [x] 9.10 部署到服务器并完成线上 health、前台、后台、采集、模拟和评分冒烟

## P10：线上战报模拟 API 模式修复

- [x] 10.1 定位线上战报模拟提示需要开启 API 模式的原因
- [x] 10.2 修复线上 H5 默认远程 API 模式并兼容旧 local 缓存
- [x] 10.3 构建、部署并验证线上战报模拟接口

## P11：准备战法、施法概率与兵书跳过准备修复

- [x] 11.1 记录 P11 实施范围、验收标准和验证命令
- [x] 11.2 补充准备 1/2 回合、发动概率、跳过准备和控制打断回归测试
- [x] 11.3 实现主动准备战法队列、释放时机、取消逻辑和战报日志
- [x] 11.4 归一化兵书/配置中的跳过准备与减少准备字段
- [x] 11.5 更新模拟器规格、估算边界和工具误用教训
- [x] 11.6 运行本地 simulator、server、全量测试和 H5 构建验证
- [x] 11.7 部署到服务器并完成线上 health、catalog、战报模拟冒烟

## P12：被动、指挥、阵法、兵种战法机制补强

- [x] 12.1 记录 P12 实施范围、验收标准和验证命令
- [x] 12.2 补充被动、指挥、阵法、兵种、回合钩子和覆盖分类回归测试
- [x] 12.3 实现准备阶段类型感知、常驻状态、队伍光环和兵种条件
- [x] 12.4 增强通用 fallback 的类型/时机感知和覆盖说明
- [x] 12.5 更新模拟器规格、估算边界和工具误用教训
- [x] 12.6 运行 simulator、server、全量测试和 H5/后台构建验证
- [x] 12.7 部署到服务器并完成 health、catalog、coverage、战报模拟冒烟

## P13：规则库显式覆盖与战报精度继续补强

- [x] 13.1 记录 P13 实施范围、验收标准和验证命令
- [x] 13.2 补充指挥/阵法、兵种、主动、突击显式规则回归测试
- [x] 13.3 实现高影响战法 explicit 规则并保持现有模拟流程
- [x] 13.4 复核 ruleCoverage explicit/fallback/missed 分类和 published catalog 数据源
- [x] 13.5 更新模拟器规格、估算边界和工具误用教训
- [x] 13.6 运行 simulator、server、全量测试和 H5/后台构建验证
- [x] 13.7 部署到服务器并完成 health、catalog、coverage、战报模拟冒烟

## P14：继续补强高影响战法规则与覆盖闭环

- [x] 14.1 记录 P14 实施范围、验收标准和验证命令
- [x] 14.2 确认 published 版本覆盖基线和 P14 候选规则
- [x] 14.3 补充阵法/指挥、兵种、主动、突击显式规则回归测试
- [x] 14.4 实现 P14 高影响战法 explicit 规则并保持现有模拟流程
- [x] 14.5 复核 ruleCoverage 分类、published catalog 数据源和 assumptions 边界
- [x] 14.6 更新模拟器规格与 P14 验证记录
- [x] 14.7 运行 simulator、server、全量测试和 H5/后台构建验证
- [x] 14.8 部署到服务器并完成 health、catalog、coverage、战报模拟冒烟
- [x] 14.9 创建中文 commit，不执行 push

## P15：战报模拟器机制深水区与覆盖缺口持续补强

- [x] 15.1 记录 P15 实施范围、验收标准和验证命令
- [x] 15.2 复核 published 版本覆盖基线和 P15 候选规则
- [x] 15.3 补充发动率修正、属性增减、missed 战斗战法、内政 no-op 和高影响 fallback 回归测试
- [x] 15.4 实现 P15 最小机制补强和显式规则，不重写主流程
- [x] 15.5 复核 ruleCoverage 分类、published catalog 数据源和 assumptions 边界
- [x] 15.6 更新模拟器规格与 P15 验证记录
- [x] 15.7 运行 simulator、server、全量测试和 H5/后台构建验证
- [x] 15.8 部署到服务器并完成 health、catalog、coverage、战报模拟冒烟
- [x] 15.9 创建中文 commit，不执行 push


## P16：配将功能需求文档与实现规划

- [x] 16.1 生成配将功能需求规格文档
- [x] 16.2 在路线图中增加配将功能阶段入口
- [x] 16.3 在 API 文档中补充配将推荐规划
- [x] 16.4 基于需求文档进入配将一期实现计划

## P17：智能配将一期功能闭环

- [x] 17.1 增强 optimizer 入参与稳定输出
- [x] 17.2 新增前台智能配将页面和账号页入口
- [x] 17.3 支持推荐结果保存、评分、对位和战报模拟跳转
- [x] 17.4 补充 accounts/optimize 回归测试
- [x] 17.5 运行测试和前端构建验证
- [x] 17.6 更新 Review 记录并创建中文 commit，不执行 push

## P18：配将推荐模拟复核与替代增强

- [x] 18.1 记录 P18 实施范围和验证命令
- [x] 18.2 推荐页展示替代建议、评分规则覆盖和 assumptions
- [x] 18.3 推荐页新增模拟复核环境模板选择
- [x] 18.4 推荐页内复用 `simulateBattleAsync()` 做卡片级模拟复核
- [x] 18.5 保留原有跳转对位页完整模拟入口
- [x] 18.6 运行测试和 H5/小程序构建验证
- [x] 18.7 更新 Review 并创建中文 commit，不执行 push

## P19：推荐历史、复盘与反馈闭环

- [x] 19.1 记录 P19 实施范围和验证命令
- [x] 19.2 推荐页保存整次推荐方案历史，并在模拟复核/反馈后回写历史
- [x] 19.3 账号页新增推荐历史入口
- [x] 19.4 新增推荐复盘页，支持列表和详情
- [x] 19.5 新增推荐质量反馈提交封装
- [x] 19.6 轻量扩展 feedback 的 type/metadata 并补服务端测试
- [x] 19.7 后台反馈页展示和筛选推荐反馈
- [x] 19.8 运行测试、前台/后台构建验证
- [x] 19.9 更新 Review 并创建中文 commit，不执行 push

## Review

### 已完成

1. **CORS 修复**：添加 `authorization` 到允许的请求头，解决 H5 远程模式 Bearer token 认证问题。

2. **阵容 API 统一到 MySQL**：
   - `GET /api/v1/lineups` 从 MySQL 读取用户阵容
   - `POST /api/v1/lineups` 保存阵容到 MySQL
   - `DELETE /api/v1/lineups/:id` 从 MySQL 删除阵容
   - 修复 JSON 字段解析问题（generals/tactics）

3. **用户识别统一**：创建 `resolveUser` 函数，统一 Bearer token > x-user-id > anonymous 的识别规则。

4. **前端本地模式实现**：
   - `saveLineupAsync` 实现 localStorage 持久化
   - `getBattleReportsAsync` 从 localStorage 读取战报
   - `addBattleReportAsync` 保存战报到 localStorage
   - `getBattleReportStatsAsync` 计算本地战报统计
   - `deleteBattleReportAsync` 从 localStorage 删除战报

5. **测试覆盖**：添加阵容 API 的 MySQL 回归测试，验证保存、查询、删除流程。

6. **后台运营能力增强**：
   - 添加用户管理页面（Users.vue）
   - 添加战报管理页面（Reports.vue）
   - 增强阵容管理（筛选、排序、删除二次确认）
   - 添加服务端用户列表和战报列表 API
   - 增强规则管理（版本号、灰度对象、回滚）

7. **生产部署和监控**：
   - 增强 /health 端点（数据库延迟、连接数、版本信息）
   - 添加请求日志中间件（慢请求和错误日志）
   - 增强 GitHub Actions（测试、构建、部署分阶段，冒烟测试）

8. **评分和战报模型增强**：
   - 评分规则版本化（SCORING_VERSION = "1.0.0"）
   - 战报可信度分层（高/中/低/极低）
   - 阵容战报统计 API（getLineupBattleStats）
   - 评分报告添加 battleStats 字段
   - 高级订阅能力扩展（深度解释、替代战法、保存阵容、对位次数）

9. **CORS PUT 方法修复**：添加 PUT 到允许的 HTTP 方法，支持跨域 PUT 请求。

10. **缺失数据库函数补充**：
    - `getUserById`：按 ID 查询单个用户详情
    - `getFeedbackById`：按 ID 查询单条反馈
    - `deleteFeedback`：删除反馈记录
    - `getBattleReportById`：按 ID 查询单条战报
    - `getLineupById`：按 ID 查询单个阵容

11. **管理员 API 端点增强**：
    - `GET /api/admin/users/:userId`：用户详情（含阵容、抽卡、战报）
    - `DELETE /api/admin/feedback/:id`：删除反馈
    - `PUT /api/admin/battle-reports/:id`：更新战报备注

12. **admin 前端 API 补充**：
    - `setUserTier`：设置用户订阅等级
    - `deleteBattleReport`：删除战报
    - `updateBattleReport`：更新战报
    - `getBattleReportStats`：获取战报统计
    - `getFeedbackById`、`deleteFeedback`：反馈操作
    - `getEquipment`、`getTroopTactics`：资料查询
    - `getAssetAudits`、`saveAssetAudit`：资产审核
    - `resetStore`、`exportStore`：数据管理

13. **admin 页面功能增强**：
    - Users.vue：订阅等级修改（升级/降级）、详情弹窗加载用户阵容和战报
    - Reports.vue：战报删除操作、统计信息展示（胜率、可信度、趋势）
    - Catalog.vue：加载装备和兵种战法数据

14. **战报模拟器 MVP**：
    - 新增服务端回合制模拟器，支持准备阶段、最多 8 回合、先攻/速度行动顺序、兵种适性、兵种克制、增伤减伤、治疗、控制状态和固定 seed 复现。
    - 新增第一批显式战法规则：盛气凌敌、横扫千军、暂避其锋、草船借箭、太平道法、士别三日、当锋摧决、刮骨疗毒。
    - 新增通用战法 fallback 和 assumptions 输出，未显式覆盖战法会标记估算假设。
    - 新增 `POST /api/v1/battles/simulate`，支持单次战报与批量胜率/稳定性聚合。
    - 评分报告新增模拟指标转换，保留静态评分并并列输出模拟建议。
    - 对位页新增“战报模拟”入口和弹窗，展示结果、剩余兵力、胜率、稳定性、评分建议和回合日志。

15. **战报模拟器深化：阵容输入和报告解释**：
    - 阵容输入新增 `attributePoints`、`equipment`、`bondEnabled`、`battleOptions`，兼容武将 `stats.intellect` 与 `stats.intelligence`。
    - 装备和缘分按文本关键词估算属性、先攻、抵御、洞察、规避、连击、会心/奇谋、急救/休整等效果，并写入 assumptions。
    - 单场战报新增 `highlights`，包含最高伤害、最高治疗、关键控制、关键战法和关键事件。
    - 批量模拟新增稳定性原因、样本分布、最佳样本和最差样本，保留 `ruleCoverage` 显式/估算/未命中统计。

16. **对位页模拟体验增强**：
    - 战报模拟入口改为先打开参数面板，支持设置模拟场次、最大回合、随机 seed 和固定 seed。
    - local 模式下明确提示需要切换远程 API 后才能运行完整战报模拟。
    - 模拟弹窗展示稳定性解释、关键摘要、规则覆盖率、最佳/最差样本、完整 assumptions 和可折叠回合日志。
    - 批量模拟使用样本回合日志辅助查看过程，单场模拟保留完整回合日志。

17. **赛季资料与规则更新系统**：
    - 新增资料版本、导入任务、规则待办存储层，支持草稿、发布、归档和丢弃状态。
    - 公共 catalog API 和战报模拟接口支持按 `season` / `catalogVersionId` 读取资料快照，并返回 `catalogContext`。
    - 后台新增“赛季资料”页面，支持导入审核、版本查看、发布/丢弃、规则覆盖和待办管理。
    - 用户端战报模拟弹窗新增资料版本选择，结果区展示赛季版本和战法级覆盖明细。
    - 战法规则覆盖新增 `explicit` / `fallback` / `missed` 分类，发布资料版本时自动为未覆盖战法生成待办。

18. **P9 官方公开资料采集、数据库资料优先与评分增强**：
    - 官方公开资料采集抽取为服务端共享模块，后台支持手动采集、差异审核、无差异跳过和可配置定时采集。
    - 生产接口默认从数据库已发布资料版本读取武将、战法、装备和兵种战法；静态 catalog 仅作为开发/测试/初始化 fallback。
    - 公共 catalog、评分、对位预览、战报模拟和账号优化均注入 `catalogContext`，支持默认赛季、指定赛季和指定 `catalogVersionId`。
    - 评分报告新增资料版本、规则覆盖、模拟摘要、规则可信度、模拟复核和可信度解释，前台评分页同步展示。
    - 对位页强化“战报模拟”入口，底部 tab 色值、图标尺寸和 H5 展示样式已统一。



19. **P11 准备战法、发动概率与兵书跳过准备修复**：
    - 主动/行动型自带战法会先判定发动概率，失败记录 `未发动`；准备完成释放不再二次判定概率。
    - 准备 1 回合和 2 回合主动战法进入武将 pending 队列，按后续主动阶段释放，期间记录 `开始准备`、`准备中`、`准备完成`。
    - 支持 `prepareModifiers`、`battleBooks`、`books` 中的跳过准备、减少准备和概率跳过准备配置，并在 assumptions 标注估算来源。
    - pending 准备战法在武将死亡、计穷、震慑或战法禁用时取消并记录 `准备取消`。

20. **P12 被动、指挥、阵法、兵种战法机制补强**：
    - 被动、指挥、阵法、兵种不再只按准备阶段粗略一次性估算，而是按公开资料拆分为常驻状态、队伍光环、兵种限定、回合触发和准备阶段效果。
    - 通用 fallback 已按战法类型和描述选择自身、主将、副将、友军全体或敌军目标；准备类增伤、减伤、先攻、洞察、规避、抵御、会心、奇谋、休整、持续治疗、急救和持续伤害会注册为长持续状态并写入来源日志。
    - 兵种战法会检查当前队伍兵种与描述条件，不匹配时跳过效果并在 `assumptions` 说明原因。
    - 新增 `锋矢阵` 与 `象兵` 代表性显式规则，继续在 `ruleCoverage` 与 `assumptions` 标注无法精确复刻官方隐藏公式的估算边界。
    - 生产 API 继续从数据库 published catalog snapshot 读取资料；静态 catalog 只作为开发、测试或初始化 fallback。

21. **P13 高影响战法显式覆盖补强**：
    - 新增八门金锁阵、抚辑军民、御敌屏障等指挥/阵法代表规则，准备阶段稳定施加先攻、减伤或休整近似效果。
    - 新增藤甲兵、陷阵营、白马义从、虎豹骑、青州兵等兵种战法规则，继续检查队伍兵种，不匹配时跳过并写入 assumptions。
    - 新增破阵摧坚、杯蛇鬼车、所向披靡、据水断桥等主动规则，覆盖群体伤害、属性削弱近似、治疗和控制。
    - 新增暴戾无仁、速乘其利、弯弓饮羽等突击代表规则，仅在突击阶段触发伤害与控制。
    - 伤害、治疗和状态日志补充 `tactic` 来源字段，便于前台回合日志和测试按战法追踪效果。


22. **P15 机制深水区与覆盖缺口补强**：
    - 新增发动率修正状态，主动和突击战法触发概率会受 `发动率提升/降低` 影响，准备战法仍遵循“判定发动 → 准备 → 释放”的既有队列。
    - 新增有效属性计算，`武力/智力/统率/属性` 提升或降低会实际影响兵刃伤害、谋略伤害和治疗量，而不是只写日志。
    - 清理剩余战斗 `missed`：`舌战群儒`、`智计`、`竭力佐谋`、`顾盼生姿` 均进入 explicit，并通过状态、发动率或属性效果验证。
    - 将 `清流雅望`、`功勋克举`、`国色`、`花容月貌`、`七步成诗`、`水镜先生`、`克遵画一`、`王佐之才`、`奇施经略`、`天香`、`戮力上国`、`晓知良木`、`经术政要`、`仓廪而实` 标为内政/非战斗 explicit no-op，不再污染战斗规则缺口。
    - 新增 `潜龙阵`、`形一阵`、`工神`、`乱世奸雄`、`火烧连营`、`威震华夏`、`五雷轰顶` 显式规则；公开资料无法精确还原的条件、目标权重和隐藏系数继续写入 assumptions。


23. **P16 配将功能需求文档**：
    - 新增 `docs/lineup-recommendation-spec.md`，把用户后续要做的配将功能沉淀为需求规格，覆盖背景目标、用户场景、参考页面能力拆解、一期范围、非目标、输入输出、页面交互、接口数据流、验收标准和风险边界。
    - `docs/ROADMAP.md` 增加配将功能规划入口，明确 P16-P19 的后续路线。
    - `docs/API.md` 补充配将推荐规划，说明一期复用 `POST /api/v1/accounts/optimize`，后续可扩展 `POST /api/v1/lineups/recommend`，并继续要求返回资料版本与估算说明。


23. **P17 智能配将一期功能闭环**：
    - `POST /api/v1/accounts/optimize` 与服务端/前端本地 optimizer 支持目标队数、排除武将/战法、偏好兵种和稳定响应结构，响应补充 `summary.targetLineupCount`、`summary.generatedLineupCount`、`warnings`、`unused.generalIds/tacticIds`、推荐理由和规则覆盖摘要。
    - 前台新增“智能配将”页面，支持手动选择武将和战法库存、目标队数、场景和偏好兵种，调用现有账号优化接口生成最多 3 套共存阵容。
    - 账号页“AI 配将/去配将”入口已接入新页面；推荐结果支持保存阵容、预填评分页、进入对位页和触发战报模拟入口。
    - 评分页支持从推荐阵容读取 `pendingAnalyzeLineup` 并预填武将、战法、场景和兵种；对位页支持 `pendingMatchupLineup` 和 `pendingMatchupAction`，并优先使用推荐阵容中的 ID 字段。


24. **P18 配将推荐模拟复核与替代增强**：
    - 智能配将推荐卡新增替代建议展示，直接呈现评分报告 `replacements` 中的战法/武将替代方向、质量和原因。
    - 推荐卡新增评分规则覆盖和 assumptions 摘要，区分显式规则、通用估算和未覆盖项，避免用户把推荐分误解为官方结论。
    - 推荐结果区新增模拟复核环境模板和模拟场次选择，复用现有环境阵容模板作为敌方输入。
    - 推荐卡内新增“模拟复核”按钮，直接复用 `simulateBattleAsync()` 调用现有战报模拟接口，卡内展示胜率、场次、稳定性、评分建议、模拟规则覆盖和模拟 assumptions。
    - 原有保存、去评分、去对位和跳转完整战报模拟入口保留。


25. **P19 推荐历史、复盘与反馈闭环**：
    - 智能配将页会保存整次推荐方案历史，包含输入库存、推荐摘要、推荐阵容、替代建议、规则覆盖、assumptions、模拟复核和反馈状态。
    - 推荐页模拟复核成功后会回写历史中的对应阵容；用户可对推荐卡提交“有帮助/不适合”反馈，本地历史同步记录反馈状态。
    - 账号页新增推荐历史入口，展示最近推荐方案并可进入复盘。
    - 新增推荐复盘页，支持历史列表和单次推荐详情，保留保存阵容、去评分、去对位操作。
    - feedback 表轻量扩展 `type` 和 `metadata`，推荐反馈通过现有反馈接口入库；后台反馈页可筛选并展示推荐反馈摘要。

26. **P20 智能配将批量选择优化**：
    - 智能配将选择器新增“全选当前筛选”，武将和战法均可按当前搜索词与筛选 chip 批量加入。
    - 武将选择器新增“全选魏 / 蜀 / 吴 / 群”，按 `faction` 批量加入对应国家武将。
    - 推荐页批量追加统一去重，重复点击不会重复加入；原有单选、删除、生成推荐逻辑保持不变。

### 验证结果

- `node tests/simulator.test.mjs` 通过 33/33，新增覆盖 P13 指挥/阵法、兵种、主动和突击代表显式规则。
- `npm test` 全部通过，覆盖 catalog、catalogDiff、catalogVersionStore、scoring、simulator 33/33、server 23/23、drawStorage。
- `npm test` 全部通过（catalog、catalogDiff、catalogVersionStore、scoring、simulator、server、drawStorage）
- `node tests/scoring.test.mjs` 已覆盖评分新增维度、规则覆盖信号、模拟摘要、资料快照上下文和对位共享 `catalogContext`
- `node tests/simulator.test.mjs` 通过 16/16，覆盖状态系统、规则覆盖率、阵容扩展输入、初始状态入场和指定资料快照模拟
- `node tests/server.test.mjs` 通过 23/23，覆盖模拟 API、管理鉴权、P8 导入/发布/按版本查询/按版本模拟闭环、P9 默认数据库已发布资料版本、指定 `catalogVersionId` 优先级、生产无发布版本不回退静态 catalog、官方采集草稿和无差异跳过
- `POST /api/v1/battles/simulate` 已通过测试服务实例验证，批量响应包含 `aggregate`、`ruleCoverage`、`bestSample`、`worstSample`、`catalogContext`
- `node -e "require('./server/app')"` 后端模块加载通过
- `npm --prefix src run build:h5` 构建成功
- `npm --prefix admin run build` 构建成功（仅有依赖注释和 chunk 体积警告）
- `./scripts/deploy.sh` 已成功发布到生产服务器，PM2 `sgzzlb-server` 重启后状态为 online；最新官方采集 Node 兼容修复已确认部署到 `/var/www/sgzzlb/backend/officialCatalogFetcher.js`
- `GET https://sz.qihangwk.com/health` 返回 200
- `GET https://sz.qihangwk.com/` 返回 200
- `GET https://sz.qihangwk.com/admin/` 返回 200
- `GET https://sz.qihangwk.com/api/v1/catalog/summary` 返回 200，命中数据库 published 资料版本 `cv_1781684387650_jblo3z`，`catalogContext.status` 为 `published`
- `GET https://sz.qihangwk.com/api/v1/catalog/generals?season=pk` 返回 200，线上数据库资料可读取
- `POST https://sz.qihangwk.com/api/v1/lineups/analyze` 返回 200，响应包含 `catalogContext`、`analysisSignals.ruleCoverage` 和模拟信号字段
- `POST https://sz.qihangwk.com/api/v1/battles/simulate` 使用线上资料真实 ID 冒烟通过，响应包含数据库 `catalogContext` 和 `ruleCoverage.coverageByTactic`
- 远端直接加载 `/var/www/sgzzlb/backend/officialCatalogFetcher.js` 并调用官方公开资料列表接口成功，返回 `ok: true`、武将总数 112，确认 `fetch is not defined` 兼容问题已修复
- `POST https://sz.qihangwk.com/api/admin/catalog/import-jobs/official` 无 token 返回 401；生产已配置 root-only `/etc/sgzzlb.env`，包含 `ADMIN_TOKEN`、`TOKEN_SECRET`、`NODE_ENV=production`、`DEFAULT_CATALOG_SEASON=pk`，真实密钥未写入仓库或输出到日志
- `POST /api/admin/catalog/import-jobs/official` 使用 `x-admin-token` 授权后返回 200，创建官方采集草稿 `cij_1781685760528_j90762` / 资料版本 `cv_1781685760413_f1woxc`，采集计数为武将 112、战法 209、兵种战法 12、装备 57
- 官方采集不会自动发布；复验公开 catalog summary 仍命中原数据库 published 版本 `cv_1781684387650_jblo3z`
- `POST https://sz.qihangwk.com/api/v1/battles/simulate` 使用线上资料真实 ID 重新冒烟通过，响应包含数据库 `catalogContext` 和 `ruleCoverage.coverageByTactic`
- 已修复线上 H5 战报模拟误判本地模式的问题：非 localhost 域名会强制使用 remote API，并把同源域名作为默认 `baseUrl`；旧浏览器缓存中的 `mode: local` 不再阻止线上调用模拟接口
- `npm --prefix src run build:h5` 构建成功；`./scripts/deploy.sh` 已重新部署，PM2 `sgzzlb-server` 为 online
- 线上复验 `GET https://sz.qihangwk.com/health`、`GET https://sz.qihangwk.com/`、`GET https://sz.qihangwk.com/api/v1/catalog/summary` 均返回 200，catalog summary 命中数据库 published 版本
- 线上 H5 分包已确认包含 `U()&&(t.mode="remote")` 修复逻辑，对位页分包已确认包含“服务器默认发布资料”文案
- P13 已部署到生产服务器，PM2 `sgzzlb-server` 重启后为 online；`GET https://sz.qihangwk.com/health` 返回 200，`GET https://sz.qihangwk.com/api/v1/catalog/summary` 返回 200 并命中数据库 published 资料版本 `cv_1781684387650_jblo3z`。
- P13 线上 rule coverage 复验通过：published 版本统计为 `total=221`、`explicit=45`、`fallback=157`、`missed=19`、`todo=20`，较 P12 前 explicit 从 27 增至 45。
- P13 线上 `POST https://sz.qihangwk.com/api/v1/battles/simulate` 使用 published 真实资料 ID 冒烟通过，`catalogContext.status=published`，战报日志包含 `八门金锁阵`、`白马义从`、`虎豹骑`、`暴戾无仁`、`杯蛇鬼车`、`据水断桥` 的 `tactic` 来源字段，`ruleCoverage.coverageByTactic` 中相关战法为 `explicit` / `explicit-rule`。
- P14 基线已确认：线上 `GET https://sz.qihangwk.com/api/v1/catalog/summary` 命中数据库 published 版本 `cv_1781684387650_jblo3z`；P13 线上覆盖基线为 `total=221`、`explicit=45`、`fallback=157`、`missed=19`、`todo=20`。P14 候选从该 published 初始快照中选择，优先补 `箕形阵`、`三势阵`、`武锋阵`、`无当飞军`、`白毦兵`、`大戟士`、`锦帆军`、`夺魂挟魄`、`威谋靡亢`、`焚辎营垒`、`绝其汲道` 等仍需显式覆盖或高影响 fallback 的战法。
- P14 已新增 `箕形阵`、`三势阵`、`武锋阵`、`无当飞军`、`白毦兵`、`大戟士`、`锦帆军`、`夺魂挟魄`、`威谋靡亢`、`焚辎营垒`、`绝其汲道`、`鬼神霆威`、`克敌制胜` 显式规则；`node tests/simulator.test.mjs` 通过 37/37，新增用例覆盖阵法、兵种、主动、突击规则及兵种不匹配 assumptions。
- P14 覆盖复核完成：生产资料来源仍为数据库 published catalog snapshot，线上 catalog summary 命中 `cv_1781684387650_jblo3z`；本地 `classifyTacticCoverage()` 复核为 `total=221`、`explicit=62`、`fallback=141`、`missed=18`，新增规则均为 `explicit` / `explicit-rule`，公开资料无法精确还原的阵法目标、适性、属性偷取、概率追击等继续写入 assumptions。
- P14 模拟器规格已更新到 `docs/battle-simulator-spec.md`，新增阵法、兵种、主动、突击规则列表和估算边界说明。
- P14 本地完整验证通过：`node tests/simulator.test.mjs`、`node tests/server.test.mjs`、`npm test`、`npm --prefix src run build:h5`、`npm --prefix admin run build` 均成功；后台构建仅保留既有 `@vueuse/core` pure annotation 与 chunk 体积警告。
- P14 已部署到生产服务器：`./scripts/deploy.sh` 执行成功，PM2 `sgzzlb-server` online；线上 `GET https://sz.qihangwk.com/health` 返回 200 且数据库正常，`GET /api/v1/catalog/summary` 继续命中数据库 published 版本 `cv_1781684387650_jblo3z`。
- P14 线上 coverage 复验通过：published 版本统计为 `total=221`、`explicit=62`、`fallback=141`、`missed=18`、`todo=20`，`箕形阵`、`三势阵`、`武锋阵`、`无当飞军`、`白毦兵`、`大戟士`、`锦帆军`、`夺魂挟魄`、`威谋靡亢`、`焚辎营垒`、`绝其汲道`、`鬼神霆威`、`克敌制胜` 均为 `explicit` / `explicit-rule`。
- P14 线上真实战报模拟冒烟通过：响应使用数据库 `published` catalog snapshot，回合日志覆盖阵法、兵种、主动代表规则；单独突击 payload 验证 `鬼神霆威` 在突击阶段造成兵刃伤害、`克敌制胜` 在突击阶段造成谋略伤害，二者均出现在 `ruleCoverage.coverageByTactic`。


- `node tests/simulator.test.mjs` 通过 22/22，新增覆盖准备 1/2 回合、发动概率、跳过准备和控制打断 pending 取消。
- `node tests/server.test.mjs` 通过 23/23，确认模拟 API 与资料版本相关服务端回归未受影响。
- `npm test` 全部通过，覆盖 catalog、catalogDiff、catalogVersionStore、scoring、simulator 22/22、server 23/23、drawStorage。
- `npm --prefix src run build:h5` 构建成功。
- `npm --prefix admin run build` 构建成功，仅保留依赖 pure annotation 与 chunk 体积既有警告。
- `node tests/simulator.test.mjs` 通过 29/29，新增覆盖真实资料形态 `象兵(type=骑兵)`：骑兵队伍准备阶段施加全队减伤，盾兵不匹配时跳过并记录 assumptions。
- `node tests/server.test.mjs` 通过 23/23，确认模拟 API、资料版本和生产数据库发布版本回归未受影响。
- `npm test` 全部通过，覆盖 catalog、catalogDiff、catalogVersionStore、scoring、simulator 29/29、server 23/23、drawStorage。
- `npm --prefix src run build:h5` 构建成功。
- `npm --prefix admin run build` 构建成功，仅保留依赖 pure annotation 与 chunk 体积既有警告。
- `./scripts/deploy.sh` 已成功部署当前版本，PM2 `sgzzlb-server` 重启后状态为 online。
- `GET https://sz.qihangwk.com/health` 返回 200。
- `GET https://sz.qihangwk.com/api/v1/catalog/summary` 返回 200，命中数据库 published catalog snapshot `cv_1781684387650_jblo3z`。
- 后台 `rule-coverage` 线上复验通过：`锋矢阵`、`象兵(type=兵种)`、`象兵(type=骑兵)` 均为 `explicit` / `explicit-rule`。
- `POST https://sz.qihangwk.com/api/v1/battles/simulate` 使用线上真实 ID 复验通过，`catalogContext.status=published`，`象兵(type=骑兵)` 在准备阶段产生 3 条全队 `减伤` 日志，并在 `ruleCoverage.coverageByTactic` 中标记 `explicit`。

- `./scripts/deploy.sh` 已成功部署当前版本，PM2 `sgzzlb-server` 重启后状态为 online。
- `GET https://sz.qihangwk.com/health` 返回 200，数据库状态正常。
- `GET https://sz.qihangwk.com/api/v1/catalog/summary` 返回 200，继续命中数据库 published catalog snapshot。
- `POST https://sz.qihangwk.com/api/v1/battles/simulate` 使用自定义 100% 概率准备战法冒烟通过，线上回合日志包含 `开始准备` 和下一回合 `准备完成`。
- `POST https://sz.qihangwk.com/api/v1/battles/simulate` 使用线上真实武将/战法 ID 冒烟通过，响应包含数据库 `catalogContext` 与 `ruleCoverage.coverageByTactic`。

- `node tests/simulator.test.mjs` 通过 28/28，新增覆盖被动常驻、指挥队伍光环、阵法位置光环、兵种条件、非主动回合钩子和 P12 显式规则分类。
- `node tests/server.test.mjs` 通过 23/23，确认模拟 API、资料版本和生产数据库发布版本回归未受影响。
- `npm test` 全部通过，覆盖 catalog、catalogDiff、catalogVersionStore、scoring、simulator 28/28、server 23/23、drawStorage。
- `npm --prefix src run build:h5` 构建成功。
- `npm --prefix admin run build` 构建成功，仅保留依赖 pure annotation 与 chunk 体积既有警告。


- P15 本地规则覆盖复核通过：`total=221`、`explicit=87`、`fallback=134`、`missed=0`；`舌战群儒`、`智计`、`竭力佐谋`、`顾盼生姿`、`潜龙阵`、`形一阵`、`工神`、`乱世奸雄`、`火烧连营`、`威震华夏`、`五雷轰顶` 以及内政 no-op 代表项均为 `explicit` / `explicit-rule`。
- `node tests/simulator.test.mjs` 通过 43/43，新增覆盖 P15 发动率修正、属性增减、剩余 missed 战斗战法、内政 no-op、高影响阵法/指挥和主动准备规则。

- P15 本地完整验证通过：`node tests/simulator.test.mjs` 43/43、`node tests/server.test.mjs` 23/23、`npm test` 全部通过，`npm --prefix src run build:h5` 和 `npm --prefix admin run build` 构建成功；后台构建仅保留既有 `@vueuse/core` pure annotation 与 chunk 体积警告。

- P15 已部署到生产服务器：`./scripts/deploy.sh` 执行成功，PM2 `sgzzlb-server` online；线上 `GET https://sz.qihangwk.com/health` 返回 `ok`，`GET /api/v1/catalog/summary` 继续命中数据库 published catalog snapshot `cv_1781684387650_jblo3z`。
- P15 线上 coverage 复验通过：published 版本统计为 `total=221`、`explicit=87`、`fallback=134`、`missed=0`、`todo=20`，`舌战群儒`、`智计`、`竭力佐谋`、`顾盼生姿`、`潜龙阵`、`形一阵`、`工神`、`乱世奸雄`、`火烧连营`、`威震华夏`、`五雷轰顶` 以及内政 no-op 代表项均为 `explicit` / `explicit-rule`。
- P15 线上真实战报模拟冒烟通过：响应使用数据库 `published` catalog snapshot，回合日志包含发动率提升/降低、武力/智力降低、属性提升、内政 `战斗不结算`、准备完成、伤害、控制和持续治疗等 P15 规则效果，`ruleCoverage.coverageByTactic` 中相关战法均为 `explicit` / `explicit-rule`。

- P16 配将需求文档已生成：`docs/lineup-recommendation-spec.md` 可独立说明配将功能目标、一期范围、非目标、输入输出、页面交互、接口数据流、复用能力、验收标准和风险边界；`docs/ROADMAP.md`、`docs/API.md`、`tasks/todo.md` 已补充入口。


- P17 完整验证通过：`npm test` 全部通过，新增 `P17 账号优化支持目标队数、排除项和稳定响应结构`、`P17 账号优化裁剪目标队数并在库存不足时返回稳定结构` 两个服务端回归用例。
- `npm --prefix src run build:h5` 构建成功，验证新增智能配将 H5 页面可编译。
- `npm --prefix src run build:mp-weixin` 构建成功，验证小程序页面配置和新增页面可编译。
- P17 浏览器点验尝试受限：`preview_start` 启动 uni dev server 与静态 `npx serve` 均未实际监听 5173 端口，页面停留在 `Awaiting server…`；本轮已通过 `npm test`、H5 构建和小程序构建覆盖自动化验证，需后续在本地浏览器或微信开发者工具中补手动点验。


- P18 自动验证通过：`npm test` 全部通过，覆盖既有评分、模拟器、服务端 API、P17 账号优化和 drawStorage 回归。
- `npm --prefix src run build:h5` 构建成功，验证推荐页新增替代建议、规则覆盖、环境模板 picker 和卡片级模拟复核 UI 可编译。
- `npm --prefix src run build:mp-weixin` 构建成功，验证小程序端新增推荐页模板和状态逻辑可编译。
- P18 浏览器点验尝试受限：`preview_start` 显示启动成功但 5173 端口未实际监听，页面停留在 `Awaiting server…`；本轮已记录限制，需后续在本地浏览器或微信开发者工具补人工点验。


- P19 自动验证通过：`node tests/server.test.mjs` 通过 29/29，覆盖普通反馈兼容、推荐历史 MySQL 持久化、推荐反馈 `type/metadata`、非法类型和超长 metadata。
- `npm test` 全部通过，覆盖 catalog、catalogDiff、catalogVersionStore、scoring、simulator、server、drawStorage。
- `npm --prefix src run build:h5` 构建成功，验证推荐页、推荐历史与复盘页 H5 可编译。
- `npm --prefix src run build:mp-weixin` 构建成功，验证推荐历史与复盘页小程序端可编译。
- `npm --prefix admin run build` 构建成功，仅保留既有 `@vueuse/core` pure annotation 和 chunk 体积警告。
- P19 H5 浏览器点验通过：`.claude/launch.json` 使用 5174 端口启动 `sgzzlb-h5` 静态预览，登录页可加载，推荐复盘路由 `#/pages/recommend/history` 可加载空历史状态，控制台无错误。

- P20 自动验证通过：`npm --prefix src run build:h5` 构建成功，验证智能配将批量选择 H5 可编译。
- `npm --prefix src run build:mp-weixin` 构建成功，验证选择器批量操作小程序端可编译。
- P20 H5 浏览器点验通过：5174 预览中智能配将页可加载；武将选择器显示“全选当前筛选”和“全选魏/蜀/吴/群”；“全选魏”一次加入 32 名武将，重复点击不重复；搜索“刘”后“全选当前筛选”仅新增匹配武将；战法“全选当前筛选”一次加入 221 个战法，重复点击不重复；控制台无错误。

### 剩余任务（非代码层面）

- HTTPS 配置和微信小程序合法域名校验（需要服务器配置）
- 数据库定时备份和恢复演练（需要服务器配置）
