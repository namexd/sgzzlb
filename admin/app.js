const DEFAULT_CONFIG = {
  apiBase: "http://127.0.0.1:8787",
  adminToken: "dev-admin-token"
};

const state = {
  config: loadConfig(),
  dashboard: null,
  catalogSummary: null,
  rules: [],
  assetAudits: [],
  auditLog: [],
  lineups: [],
  generals: [],
  rulesFilter: "",
  assetsFilter: "",
  assetsStatus: "",
  auditFilter: "",
  auditLevel: "",
  storeBusy: false,
  assetsBusy: false
};

const reportQueue = [
  {
    name: "战报截图导入",
    status: "待接入",
    progress: 15,
    note: "V2 需要 OCR、手动校验和样本去重。"
  },
  {
    name: "手动录入模板",
    status: "可设计",
    progress: 35,
    note: "优先支持阵容、兵种、胜负、战损和回合数。"
  },
  {
    name: "样本可信度分层",
    status: "规划中",
    progress: 20,
    note: "区分同红度、战法完整度和赛季环境。"
  }
];

const subscriptionMonitor = [
  ["免费层", "资料查询、基础评分、单队对位预览"],
  ["高级订阅", "深度解释、批量对位、保存更多阵容、替代方案"],
  ["服务端权益", "正式上线时接微信支付、订单回调和服务端验签"]
];

function $(id) {
  return document.getElementById(id);
}

function loadConfig() {
  try {
    return {
      ...DEFAULT_CONFIG,
      ...(JSON.parse(localStorage.getItem("sgzzlb-admin-config")) || {})
    };
  } catch (error) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  localStorage.setItem("sgzzlb-admin-config", JSON.stringify(state.config));
}

function setStatus(title, text, type = "") {
  $("global-status-title").textContent = title;
  $("global-status-text").textContent = text;
  const badge = $("dashboard-badge");
  badge.textContent = type === "ok" ? "已连接" : type === "fail" ? "连接失败" : "处理中";
  badge.className = `badge ${type}`;
}

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { "content-type": "application/json" } : {})
  };
  if (options.admin !== false) {
    headers["x-admin-token"] = state.config.adminToken;
  }
  const response = await fetch(`${state.config.apiBase}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.error || body.message || `接口返回 ${response.status}`);
  }
  return body;
}

async function requestAllPages(path, params = {}) {
  const pageSize = 100;
  const first = await request(withQuery(path, { ...params, page: 1, pageSize }), { admin: false });
  const items = Array.isArray(first.items) ? [...first.items] : [];
  const totalPages = Number(first.totalPages) || 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await request(withQuery(path, { ...params, page, pageSize }), { admin: false });
    items.push(...(Array.isArray(next.items) ? next.items : []));
  }
  return items;
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      query.set(key, params[key]);
    }
  });
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function statusLabel(status) {
  const labels = {
    needs_generation: "待生成",
    pending_review: "待审核",
    approved: "已通过",
    rejected: "已驳回"
  };
  return labels[status] || status || "未知";
}

function statusBadgeClass(status) {
  if (status === "approved") return "ok";
  if (status === "rejected") return "fail";
  return "warn";
}

async function loadAll() {
  setStatus("正在连接后端", `读取 ${state.config.apiBase} 的运营数据。`, "warn");
  try {
    const [dashboard, catalogSummary, rules, assetAudits, auditLog, lineups, generals] = await Promise.all([
      request("/api/admin/dashboard"),
      request("/api/v1/catalog/summary", { admin: false }),
      request("/api/admin/rules"),
      request("/api/admin/assets/audit"),
      request("/api/admin/audit-log"),
      request("/api/admin/lineups"),
      requestAllPages("/api/v1/catalog/generals")
    ]);

    state.dashboard = dashboard;
    state.catalogSummary = catalogSummary;
    state.rules = rules.items || [];
    state.assetAudits = assetAudits.items || [];
    state.auditLog = auditLog.items || [];
    state.lineups = lineups.items || [];
    state.generals = generals;
    setStatus("后端连接正常", "管理数据已刷新。", "ok");
    render();
  } catch (error) {
    setStatus("后端未连接", error.message, "fail");
    renderEmptyShell(error.message);
  }
}

function render() {
  renderMetrics();
  renderOverview();
  renderCatalogSummary();
  renderLineups();
  renderRules();
  renderAssets();
  renderReportQueue();
  renderSubscriptionMonitor();
  renderAuditLog();
}

function renderEmptyShell(message) {
  $("metric-grid").innerHTML = "";
  renderEmpty("overview-table", "无法读取运营概览", message);
  renderEmpty("overview-insights", "后端服务未就绪", "运行 npm run dev:server 后重新请求。");
  renderEmpty("catalog-summary", "暂无资料快照", "等待服务端返回目录摘要。");
  renderEmpty("lineups-list", "暂无阵容样本", "远程模式保存阵容后会出现在这里。");
  renderEmpty("rules-list", "暂无评分规则", "连接后端后可编辑规则草案。");
  renderEmpty("assets-list", "暂无资产审核", "连接后端后显示待生成武将卡。");
  renderReportQueue();
  renderSubscriptionMonitor();
  renderEmpty("audit-log", "暂无审计日志", "后台操作会在这里沉淀。");
}

function renderEmpty(targetId, title, text) {
  $(targetId).innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function renderMetrics() {
  const catalog = state.dashboard.catalog || {};
  const metrics = [
    ["武将", catalog.generals || 0, "官方快照"],
    ["战法", catalog.tactics || 0, "普通战法"],
    ["装备", catalog.equipment || 0, "装备资料"],
    ["兵种", catalog.troopTactics || 0, "兵种战法"],
    ["阵容", state.dashboard.lineups ? state.dashboard.lineups.total || 0 : 0, "用户样本"],
    ["待生成卡", state.dashboard.assets.pendingAudit || 0, "原创资产"],
    ["审计日志", state.dashboard.auditLog.total || 0, "后台操作"]
  ];
  $("metric-grid").innerHTML = metrics
    .map(
      ([label, value, note]) => `
        <div class="metric">
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${note}</small>
        </div>
      `
    )
    .join("");
}

function renderOverview() {
  const rows = [
    ["服务状态", state.dashboard.status === "ok" ? "正常" : "异常"],
    ["启用规则", `${state.dashboard.rules.enabled}/${state.dashboard.rules.total}`],
    ["保存阵容", state.dashboard.lineups ? state.dashboard.lineups.total : 0],
    ["资产审核记录", state.dashboard.assets.auditRecords],
    ["最近审计", state.dashboard.auditLog.latest.length ? state.dashboard.auditLog.latest[0].action : "暂无"]
  ];
  $("overview-table").innerHTML = rows
    .map(([label, value]) => `<div class="row"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");

  const insights = [
    ["评分可解释性", "后台规则先保留草案能力，正式版再把权重版本化并写入评分报告。"],
    ["账号同步", "阵容样本用于观察真实保存行为，暂不作为战报胜率训练数据。"],
    ["原创资产", "当前所有武将卡仍是待生成状态，生成后必须经过相似度和人工审核。"],
    ["商业化", "订阅权益只能做本地开关演示，生产环境必须接服务端鉴权。"]
  ];
  $("overview-insights").innerHTML = insights.map(([title, text]) => note(title, text)).join("");
}

function renderCatalogSummary() {
  const counts = state.catalogSummary.counts || {};
  const meta = state.catalogSummary.meta || {};
  const rows = [
    ["武将", counts.generals || meta.generalsCount || 0],
    ["战法", counts.tactics || meta.tacticsCount || 0],
    ["装备", counts.equipment || meta.equipmentCount || 0],
    ["兵种", counts.troopTactics || meta.troopTacticsCount || 0],
    ["官方图片剔除", meta.officialMediaUrlsExcluded ? "是" : "待确认"],
    ["来源", state.catalogSummary.source || meta.source || "本地快照"]
  ];
  $("catalog-summary").innerHTML = rows.map(([title, text]) => note(title, String(text))).join("");
  $("catalog-badge").textContent = "已核验";
  $("catalog-badge").className = "badge ok";
}

function renderLineups() {
  const records = state.lineups.slice(0, 12);
  $("lineups-list").innerHTML = records.length
    ? records
        .map(
          (item) => `
            <div class="lineup-item">
              <div>
                <strong>${escapeHtml((item.generals || []).join(" / ") || "未命名阵容")}</strong>
                <p>${escapeHtml(item.scenario || "-")} · ${escapeHtml(item.troop || "-")} · ${escapeHtml((item.tactics || []).join(" / ") || "未记录战法")}</p>
                <span class="mini">${escapeHtml(item.userId || "local-demo")} · ${escapeHtml(item.updatedAt || item.createdAt || "-")}</span>
              </div>
              <div class="lineup-score">
                <span class="badge ok">${escapeHtml(item.score === null || item.score === undefined ? "无评分" : `${item.score} 分`)}</span>
              </div>
            </div>
          `
        )
        .join("")
    : emptyMarkup("暂无阵容样本", "小程序切换远程 API 并保存阵容后会入库。");
  $("lineups-badge").textContent = `${state.lineups.length} 套`;
  $("lineups-badge").className = state.lineups.length ? "badge ok" : "badge warn";
}

function renderRules() {
  const keyword = state.rulesFilter.trim().toLowerCase();
  const rules = state.rules.filter((rule) => {
    const body = `${rule.name} ${rule.description}`.toLowerCase();
    return !keyword || body.includes(keyword);
  });
  $("rules-list").innerHTML = rules.length
    ? rules
        .map(
          (rule, index) => `
            <div class="rule-item" data-rule-id="${escapeHtml(rule.id)}">
              <strong>${escapeHtml(rule.name)}</strong>
              <p>${escapeHtml(rule.description || "暂无说明")}</p>
              <div class="rule-grid">
                <label>
                  <span>规则名称</span>
                  <input data-field="name" value="${escapeHtml(rule.name)}" />
                </label>
                <label>
                  <span>状态</span>
                  <select data-field="enabled">
                    <option value="true" ${rule.enabled !== false ? "selected" : ""}>启用</option>
                    <option value="false" ${rule.enabled === false ? "selected" : ""}>停用</option>
                  </select>
                </label>
                <label>
                  <span>序号</span>
                  <input value="${index + 1}" disabled />
                </label>
                <label class="rule-description">
                  <span>规则说明</span>
                  <textarea data-field="description" rows="3">${escapeHtml(rule.description || "")}</textarea>
                </label>
                <div class="rule-actions">
                  <button type="button" class="ghost" data-rule-delete="${escapeHtml(rule.id)}">删除草案</button>
                </div>
              </div>
            </div>
          `
        )
        .join("")
    : emptyMarkup("没有匹配的评分规则", "调整搜索词后再试。");
  $("rules-badge").textContent = `${rules.length} 条`;
  $("rules-badge").className = "badge ok";
}

function updateRuleDraft(ruleId, field, value) {
  const rule = state.rules.find((item) => item.id === ruleId);
  if (!rule) return;
  rule[field] = field === "enabled" ? value === "true" : value;
}

function addRuleDraft() {
  const id = `draft-rule-${Date.now()}`;
  state.rules.unshift({
    id,
    name: "新规则草案",
    enabled: true,
    description: "填写这条评分规则的适用条件、影响维度和上线理由。"
  });
  state.rulesFilter = "";
  $("rules-filter").value = "";
  setStatus("已新增规则草案", "编辑后点击保存草案写入后端。", "warn");
  renderRules();
}

function deleteRuleDraft(ruleId) {
  const before = state.rules.length;
  state.rules = state.rules.filter((rule) => rule.id !== ruleId);
  setStatus("已删除规则草案", `当前还有 ${state.rules.length} 条，保存后生效。`, before === state.rules.length ? "fail" : "warn");
  renderRules();
}

function collectRulesDraft() {
  return state.rules.map((rule, index) => ({
    id: rule.id || `rule-${index + 1}`,
    name: (rule.name || `规则 ${index + 1}`).trim(),
    enabled: rule.enabled !== false,
    description: rule.description || ""
  }));
}

async function saveRulesDraft() {
  const rules = collectRulesDraft();
  try {
    const result = await request("/api/admin/rules", {
      method: "POST",
      body: { rules }
    });
    state.rules = result.items || [];
    setStatus("规则草案已保存", `已保存 ${state.rules.length} 条规则。`, "ok");
    await refreshAuditLog();
    renderRules();
    renderAuditLog();
  } catch (error) {
    setStatus("规则保存失败", error.message, "fail");
  }
}

function renderAssets() {
  const auditByTarget = new Map(state.assetAudits.map((item) => [item.targetId, item]));
  const keyword = state.assetsFilter.trim().toLowerCase();
  const records = state.generals
    .map((general) => {
      const audit = auditByTarget.get(general.id);
      const status = audit ? audit.status : general.asset && general.asset.status ? general.asset.status : "needs_generation";
      return { general, audit, status };
    })
    .filter(({ general, status }) => {
      const body = `${general.name} ${general.faction} ${(general.tags || []).join(" ")} ${status}`.toLowerCase();
      return (!keyword || body.includes(keyword)) && (!state.assetsStatus || status === state.assetsStatus);
    })
    .slice(0, 36);

  $("assets-list").innerHTML = records.length
    ? records
        .map(({ general, audit, status }) => {
          const risk = status === "approved" ? "已通过" : status === "rejected" ? "已驳回" : status === "pending_review" ? "待人工审核" : "待生成";
          return `
            <div class="asset-item">
              <div class="avatar-mark">${escapeHtml((general.name || "?").slice(0, 1))}</div>
              <div>
                <strong>${escapeHtml(general.name)}</strong>
                <p>${escapeHtml(general.faction || "-")} · ${escapeHtml((general.tags || []).join(" / ") || "未标记")} · ${escapeHtml(risk)}</p>
                <span class="mini">${escapeHtml(audit && audit.note ? audit.note : "不得参考官网图、游戏立绘、官方卡框或竞品截图。")}</span>
              </div>
              <div class="asset-actions">
                <span class="badge ${statusBadgeClass(status)}">${escapeHtml(statusLabel(status))}</span>
                <button type="button" class="ghost" data-asset-action="pending_review" data-target-id="${escapeHtml(general.id)}">待审核</button>
                <button type="button" data-asset-action="approved" data-target-id="${escapeHtml(general.id)}">通过</button>
                <button type="button" class="ghost" data-asset-action="rejected" data-target-id="${escapeHtml(general.id)}">驳回</button>
              </div>
            </div>
          `;
        })
        .join("")
    : emptyMarkup("没有匹配的资产", "调整筛选条件后再试。");
  $("assets-badge").textContent = `${records.length} 条`;
  $("assets-badge").className = "badge warn";
  $("batch-pending-assets").disabled = state.assetsBusy;
}

async function submitAssetAudit(targetId, status) {
  try {
    const result = await request("/api/admin/assets/audit", {
      method: "POST",
      body: {
        targetId,
        targetType: "general",
        status,
        note:
          status === "approved"
            ? "人工确认原创风格可用。"
            : status === "pending_review"
              ? "已进入人工审核队列，需核验原创性和相似度。"
              : "相似度或风格风险，退回重生。"
      }
    });
    state.assetAudits = [result.item, ...state.assetAudits.filter((item) => item.targetId !== targetId)];
    setStatus("资产审核已记录", `${targetId} 已标记为${statusLabel(status)}。`, "ok");
    await refreshAuditLog();
    renderAssets();
    renderAuditLog();
  } catch (error) {
    setStatus("资产审核失败", error.message, "fail");
  }
}

function getAssetRecords() {
  const auditByTarget = new Map(state.assetAudits.map((item) => [item.targetId, item]));
  return state.generals.map((general) => {
    const audit = auditByTarget.get(general.id);
    const status = audit ? audit.status : general.asset && general.asset.status ? general.asset.status : "needs_generation";
    return { general, audit, status };
  });
}

async function markFirstTenGeneratedAsPending() {
  const targets = getAssetRecords()
    .filter(({ status }) => status === "needs_generation")
    .slice(0, 10);
  if (!targets.length) {
    setStatus("没有可批量处理的资产", "当前没有待生成记录。", "warn");
    return;
  }

  state.assetsBusy = true;
  renderAssets();
  setStatus("正在批量标记资产", `准备把 ${targets.length} 条待生成记录转为待审核。`, "warn");
  try {
    const results = [];
    for (const { general } of targets) {
      const result = await request("/api/admin/assets/audit", {
        method: "POST",
        body: {
          targetId: general.id,
          targetType: "general",
          status: "pending_review",
          note: "批量进入人工审核队列，禁止参考官网图、游戏立绘、官方卡框或竞品截图。"
        }
      });
      results.push(result.item);
    }
    const updatedIds = new Set(results.map((item) => item.targetId));
    state.assetAudits = [
      ...results,
      ...state.assetAudits.filter((item) => !updatedIds.has(item.targetId))
    ];
    setStatus("批量标记完成", `已把 ${results.length} 条待生成资产转为待审核。`, "ok");
    await refreshAuditLog();
    renderAssets();
    renderAuditLog();
  } catch (error) {
    setStatus("批量标记失败", error.message, "fail");
  } finally {
    state.assetsBusy = false;
    renderAssets();
  }
}

function setStoreButtonsDisabled(disabled) {
  state.storeBusy = disabled;
  $("export-store-button").disabled = disabled;
  $("reset-store-button").disabled = disabled;
}

async function exportStore() {
  setStoreButtonsDisabled(true);
  setStatus("正在导出 store", "请求 /api/admin/store/export。", "warn");
  try {
    const body = await request("/api/admin/store/export");
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sgzzlb-store-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("store 已导出", "导出文件已由浏览器保存。", "ok");
  } catch (error) {
    setStatus("store 导出失败", error.message, "fail");
  } finally {
    setStoreButtonsDisabled(false);
  }
}

async function resetStore() {
  if (!window.confirm("确认重置后台 store？此操作会调用后端重置接口。")) return;
  setStoreButtonsDisabled(true);
  setStatus("正在重置 store", "请求 /api/admin/store/reset。", "warn");
  try {
    await request("/api/admin/store/reset", { method: "POST", body: {} });
    setStatus("store 已重置", "已重新读取后台数据。", "ok");
    await loadAll();
  } catch (error) {
    setStatus("store 重置失败", error.message, "fail");
  } finally {
    setStoreButtonsDisabled(false);
  }
}

function renderReportQueue() {
  $("report-queue").innerHTML = reportQueue
    .map(
      (item) => `
        <div class="queue-item">
          <div>
            <strong>${item.name}</strong>
            <p>${item.note}</p>
            <div class="progress-track"><div class="progress-fill" style="width: ${item.progress}%"></div></div>
          </div>
          <div class="queue-meta"><span class="badge warn">${item.status}</span></div>
        </div>
      `
    )
    .join("");
}

function renderSubscriptionMonitor() {
  $("subscription-monitor").innerHTML = subscriptionMonitor
    .map(([title, text]) => note(title, text))
    .join("");
}

function renderAuditLog() {
  const keyword = state.auditFilter.trim().toLowerCase();
  const level = state.auditLevel;
  const records = state.auditLog
    .map((item) => ({
      ...item,
      level: item.action.includes("failed") ? "failed" : item.action.includes("warning") ? "warning" : "success"
    }))
    .filter((item) => {
      const body = `${item.action} ${JSON.stringify(item.detail || {})}`.toLowerCase();
      return (!keyword || body.includes(keyword)) && (!level || item.level === level);
    });

  $("audit-log").innerHTML = records.length
    ? records
        .map(
          (item) => `
            <div class="audit-item">
              <div>
                <strong>${escapeHtml(item.action)}</strong>
                <p>${escapeHtml(JSON.stringify(item.detail || {}))}</p>
                <span class="mini">${escapeHtml(item.createdAt || "-")}</span>
              </div>
              <div class="audit-meta"><span class="badge ${item.level === "failed" ? "fail" : item.level === "warning" ? "warn" : "ok"}">${item.level}</span></div>
            </div>
          `
        )
        .join("")
    : emptyMarkup("暂无审计日志", "保存规则或审核资产后会生成记录。");
  $("audit-badge").textContent = `${records.length} 条`;
  $("audit-badge").className = "badge ok";
}

async function refreshAuditLog() {
  const auditLog = await request("/api/admin/audit-log");
  state.auditLog = auditLog.items || [];
}

function note(title, text) {
  return `<div class="note"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function emptyMarkup(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bindEvents() {
  $("api-base").value = state.config.apiBase;
  $("admin-token").value = state.config.adminToken;

  $("api-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.config.apiBase = $("api-base").value.trim().replace(/\/$/, "") || DEFAULT_CONFIG.apiBase;
    state.config.adminToken = $("admin-token").value || DEFAULT_CONFIG.adminToken;
    saveConfig();
    loadAll();
  });

  $("retry-button").addEventListener("click", loadAll);
  $("export-store-button").addEventListener("click", exportStore);
  $("reset-store-button").addEventListener("click", resetStore);
  $("clear-button").addEventListener("click", () => {
    localStorage.removeItem("sgzzlb-admin-config");
    state.config = { ...DEFAULT_CONFIG };
    $("api-base").value = state.config.apiBase;
    $("admin-token").value = state.config.adminToken;
    setStatus("本地草案已清空", "已恢复默认 API 地址和 token。", "warn");
  });

  $("rules-filter").addEventListener("input", (event) => {
    state.rulesFilter = event.target.value;
    renderRules();
  });
  $("add-rule-draft").addEventListener("click", addRuleDraft);
  $("save-rules-draft").addEventListener("click", saveRulesDraft);
  $("rules-list").addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    const item = event.target.closest(".rule-item");
    if (!field || !item) return;
    updateRuleDraft(item.dataset.ruleId, field, event.target.value);
  });
  $("rules-list").addEventListener("change", (event) => {
    const field = event.target.dataset.field;
    const item = event.target.closest(".rule-item");
    if (!field || !item) return;
    updateRuleDraft(item.dataset.ruleId, field, event.target.value);
  });
  $("rules-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-rule-delete]");
    if (!button) return;
    deleteRuleDraft(button.dataset.ruleDelete);
  });

  $("assets-filter").addEventListener("input", (event) => {
    state.assetsFilter = event.target.value;
    renderAssets();
  });
  $("assets-status").addEventListener("change", (event) => {
    state.assetsStatus = event.target.value;
    renderAssets();
  });
  $("batch-pending-assets").addEventListener("click", markFirstTenGeneratedAsPending);
  $("assets-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-action]");
    if (!button) return;
    submitAssetAudit(button.dataset.targetId, button.dataset.assetAction);
  });

  $("audit-filter").addEventListener("input", (event) => {
    state.auditFilter = event.target.value;
    renderAuditLog();
  });
  $("audit-level").addEventListener("change", (event) => {
    state.auditLevel = event.target.value;
    renderAuditLog();
  });
}

bindEvents();
loadAll();
