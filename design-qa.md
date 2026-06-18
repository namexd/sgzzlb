# 新版 UI 复刻视觉对比验收

final result: passed

## 视觉目标

- 参考图：`src/static/ui-mockups/draw.png`
- 参考图：`src/static/ui-mockups/analyze.png`
- 参考图：`src/static/ui-mockups/matchup.png`
- 参考图：`src/static/ui-mockups/catalog.png`
- 参考图：`src/static/ui-mockups/account.png`
- 实现页：`src/pages/draw/index.vue`
- 实现页：`src/pages/analyze/index.vue`
- 实现页：`src/pages/matchup/index.vue`
- 实现页：`src/pages/catalog/index.vue`
- 实现页：`src/pages/account/index.vue`
- 页面配置：`src/pages.json`

## 验收证据

- 对比总览：`tasks/ui-qa-20260605/index.html`
- 资料对比：`tasks/ui-qa-20260605/comparisons/catalog-side-by-side-final.png`
- 抽卡对比：`tasks/ui-qa-20260605/comparisons/draw-side-by-side-final.png`
- 评分对比：`tasks/ui-qa-20260605/comparisons/analyze-side-by-side-final.png`
- 对位对比：`tasks/ui-qa-20260605/comparisons/matchup-side-by-side-final.png`
- 我的对比：`tasks/ui-qa-20260605/comparisons/account-side-by-side-final.png`
- 资料库图片放大：`tasks/ui-qa-20260605/screenshots/catalog-preview-final.png`
- 抽卡统计补充页：`tasks/ui-qa-20260605/screenshots/draw-stats-impl-final.png`
- 实现截图：`tasks/ui-qa-20260605/screenshots/*-impl-final.png`
- 卡牌去重截图：`tasks/ui-qa-20260605/screenshots/catalog-impl-card-cleanup.png`、`tasks/ui-qa-20260605/screenshots/analyze-impl-card-cleanup.png`、`tasks/ui-qa-20260605/screenshots/matchup-impl-card-cleanup.png`
- 图标接入截图：`tasks/ui-qa-20260605/screenshots/*-impl-icons.png`
- 裁图图标联系表：`tasks/ui-qa-20260605/mockup-icons-contact-sheet.png`
- 参考裁屏：`tasks/ui-qa-20260605/screenshots/*-ref-crop.png`

## 验收方式

- 视口：手机视口 `390x844`；最终实现截图和并排对比均按 `390x844` 输出。
- 状态：抽卡、评分、对位、资料、我的五个核心页默认首屏状态。
- 比较方式：裁剪 mockup 中的手机屏幕主体，与 H5 实现截图放入同一张并排图判断。
- 构建验证：在 `src/` 执行 `npm run build:h5` 通过。
- 页面验证：本地服务 `http://localhost:8083/` 可打开，5 个核心页面控制台 `error` 均为 0；资料库图片放大验证通过。

## 本轮补强

- 全局取消负字距，避免中文标题和按钮显得发紧。
- 五个核心页去掉 H5 原生导航标题栏，避免顶部黑条压缩 mockup 结构。
- 资料页改为列表资料库结构，补强武将卡片渐变描边、角花、卡面高光和搜索框内阴影。
- 抽卡页补强金属面板、角花、进度条高光、日历选中发光、快速记录按钮和主按钮浮雕。
- 评分页补强蓝紫科技边框、武将卡片光边、战法面板内发光、底部 CTA 金属按钮。
- 对位页补强红蓝阵营渐变、VS 发光、比分面板描边、胜率圆环和调整按钮浮雕。
- 我的页补强头像光环、订阅玻璃金属卡、权益格分割线、工具卡和保存阵容卡片质感。
- 资料页、评分页、对位页的有图武将卡取消额外叠加势力、统御、姓名、等级和主副将文字，避免和卡图内置信息重复。
- 放弃继续裁剪小图标，改为生成 19 个居中的金色 PNG 图标和标题装饰资源，落入 `src/static/ui-assets/mockup-icons/`，覆盖抽卡页顶部操作、快速记录、日历 token、底部入口、标题装饰，以及我的页功能入口和订阅徽章。
- 我的页订阅卡从无业务意义的“每日元宝/资源产量”改为程序真实相关的云端存档、AI 配将、抽卡统计、功能规划；保存阵容区域改为使用资料库 `asset.imageUrl` 显示真实武将缩略图，没有保存阵容时显示推荐阵容入口。
- 抽卡页快捷记录文案改为“免费/半价 + 第1组/第2组”，主操作改为“添加记录”；顶部副标题、月份切换和快速记录标题均补齐两侧装饰，订阅卡边框改为外金边、内白边和角线的多层轻量玻璃质感。
- 精简不必要文案：资料页移除“当前显示 x/y”，我的页空状态改短，并删除底部开发感数据快照。
- 资料库改为生产可用的列表结构：左侧完整展示武将卡图，右侧展示星级、定位、兵种适性、战法名称、战法简介和列传摘要；点击武将图片会打开大图预览。
- 统计页移除重复头部和“平均每 - 抽出一张橙卡”占位文案，空数据状态保留紧凑统计布局和最小空态。
- 选择弹窗和反馈页清理“输入关键词缩小搜索范围”“感谢你的建议”等提示式文案，保留必要的字段校验和操作反馈。

## 五项保真检查

- 字体与层级：采用系统中文字体，标题改为金色渐变和阴影；设计图中的书法/题字字体未引入独立字体文件，作为可接受 P3 差异保留。
- 间距与布局：核心结构已按 mockup 转为沉浸式手游界面；底部保留项目统一 tabBar，未替换为设计图里的示例菜单文案。
- 颜色与质感：深色背景、金色高亮、蓝红对阵、半透明玻璃面板、渐变边框、内外发光和按钮浮雕均已落地。
- 图片与素材：英雄图、武将图沿用现有项目资产；有图武将卡只保留图片和外层质感框，不再用额外文字压住卡面；小图标改为同风格金色 PNG 资源，避免截图裁剪偏移。
- 文案与数据：页面继续使用项目真实数据、真实排序和已有业务文案；mockup 中的月份、分数、阵容样例和保存数据仅作为视觉参考。

## 结论

- 当前实现已从“结构复刻”升级为“结构 + 游戏化质感复刻”，CSS 能实现的边框、按钮、卡片、角标、发光、阴影和渐变细节已补齐。
- 剩余差异主要来自素材和载体：mockup 是带手机外框和专用人物素材的整张视觉图，代码实现是可交互 H5 页面，并继续使用现有项目资产。
- 未发现影响交付的 P0/P1/P2 视觉问题；剩余为 P3 级素材和字体精修。

## P3 后续精修

- 如需进一步逼近设计图，可补专用武将立绘、题字字体、底部菜单图标和装饰纹章图片素材。
- 如需完全一致的 iPhone 海报效果，需要单独制作展示壳层；当前交付范围只复刻应用屏幕 UI。
