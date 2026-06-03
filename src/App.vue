<script>
export default {
  globalData: {
    appName: "三战配将分析",
    subscriptionKey: "subscriptionTier",
    apiConfigKey: "apiConfig",
    savedLineupsKey: "savedLineups",
    inventoryKey: "playerInventory",
    drawPoolsKey: "drawPools",
    tokenKey: "userToken"
  },
  onLaunch() {},
  onShow() {},
  onHide() {}
};
</script>

<style>
/* ===== 墨金古韵 Design Tokens ===== */
page {
  /* Surface layers */
  --ink-deepest: #0c0f14;
  --ink-deep: #11161d;
  --ink-mid: #161c26;
  --ink-surface: #1b2230;
  --ink-raised: #212a38;
  --ink-overlay: #283244;

  /* Text */
  --text-ink: #e8dcc8;
  --text-stone: #97a0b0;
  --text-fade: #5e6a7a;

  /* Gold */
  --gold: #c9983a;
  --gold-bright: #e4b84d;
  --gold-dim: #8a6b2a;
  --gold-ghost: rgba(201, 152, 58, 0.06);

  /* Secondary */
  --stone: #5a8faf;

  /* Semantic */
  --win: #5aad6a;
  --loss: #c45a4a;
  --draw: #c49a3a;

  /* Borders */
  --border-faint: rgba(255, 255, 255, 0.04);
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-accent: rgba(201, 152, 58, 0.25);

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 24px rgba(201, 152, 58, 0.12);

  /* Spacing */
  --sp-xxs: 4px;
  --sp-xs: 8px;
  --sp-sm: 12px;
  --sp-md: 16px;
  --sp-lg: 24px;
  --sp-xl: 32px;

  /* Typography */
  --fs-xs: 10px;
  --fs-sm: 12px;
  --fs-base: 14px;
  --fs-md: 16px;
  --fs-lg: 20px;

  /* Radius */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 20px;

  /* Transition */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);

  min-height: 100vh;
  background: var(--ink-deep);
  color: var(--text-ink);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0.02em;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

view,
text,
button,
input,
textarea,
picker {
  box-sizing: border-box;
}

/* ===== Global Components ===== */
.band {
  padding: var(--sp-lg);
  background: var(--ink-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.band::before {
  content: "";
  position: absolute;
  top: 0;
  left: var(--sp-lg);
  right: var(--sp-lg);
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(201, 152, 58, 0.15) 50%, transparent 100%);
}

.band.accent {
  border-color: var(--border-accent);
  box-shadow: var(--shadow-md), var(--shadow-glow);
}

.title {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--text-ink);
  line-height: 1.2;
  letter-spacing: 0.04em;
}

.subtitle {
  margin-top: var(--sp-xs);
  font-size: var(--fs-sm);
  color: var(--text-stone);
  line-height: 1.55;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 var(--sp-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  color: var(--text-stone);
  font-size: var(--fs-xs);
  background: var(--ink-raised);
}

.pill.gold {
  border-color: var(--border-accent);
  color: var(--gold);
  background: var(--gold-ghost);
}

.btn {
  height: 44px;
  border: 0;
  border-radius: var(--r-sm);
  color: #121008;
  background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 60%, var(--gold-dim) 100%);
  font-size: var(--fs-base);
  font-weight: 700;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 4px 16px rgba(201, 152, 58, 0.25);
  transition: transform 0.12s var(--ease), box-shadow 0.12s var(--ease);
}

.btn:active {
  transform: scale(0.97);
}

.btn[disabled] {
  color: var(--text-fade);
  background: var(--ink-raised);
  box-shadow: none;
}

.btn.secondary {
  color: var(--text-stone);
  background: var(--ink-raised);
  border: 1px solid var(--border-subtle);
  box-shadow: none;
}

.mini-btn {
  min-height: 32px;
  padding: 0 var(--sp-lg);
  border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle);
  background: var(--ink-raised);
  color: var(--text-stone);
  font-size: var(--fs-xs);
  transition: all 0.12s var(--ease);
}

.mini-btn:active {
  background: var(--ink-overlay);
  border-color: var(--border-accent);
}

.mini-btn.primary {
  border-color: var(--border-accent);
  color: var(--gold);
  background: var(--gold-ghost);
}

.field {
  min-height: 44px;
  padding: var(--sp-sm) var(--sp-lg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--ink-deep);
  color: var(--text-ink);
  font-size: var(--fs-sm);
}

.muted { color: var(--text-stone); }
.faint { color: var(--text-fade); }
.danger { color: var(--loss); }
.ok { color: var(--win); }
.gold { color: var(--gold); }

.empty {
  padding: 48px var(--sp-lg);
  text-align: center;
  color: var(--text-fade);
  font-size: var(--fs-sm);
}

.card-title {
  color: var(--text-stone);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.score {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--gold-bright);
}

.progress-track {
  height: 8px;
  margin-top: var(--sp-md);
  border-radius: 4px;
  background: var(--ink-deep);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--gold-dim) 0%, var(--gold) 100%);
  transition: width 0.4s var(--ease);
}

.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(4, 6, 10, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--ink-surface);
  border-radius: var(--r-lg);
  padding: var(--sp-xl);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-lg);
  animation: modalIn 0.25s var(--ease);
}

@keyframes modalIn {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-title {
  color: var(--text-ink);
  font-size: var(--fs-base);
  font-weight: 700;
  margin-bottom: var(--sp-lg);
}

.modal-actions {
  display: flex;
  gap: var(--sp-sm);
  margin-top: var(--sp-xl);
  justify-content: flex-end;
}

.form-row { margin-bottom: var(--sp-lg); }
.form-label {
  color: var(--text-stone);
  font-size: var(--fs-xs);
  margin-bottom: var(--sp-xs);
  display: block;
}

.form-input {
  width: 100%;
  height: 44px;
  padding: 0 var(--sp-lg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  color: var(--text-ink);
  background: var(--ink-deep);
  font-size: var(--fs-sm);
  box-sizing: border-box;
}

.form-input:focus { border-color: var(--border-accent); }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-sm);
  margin-bottom: var(--sp-lg);
}

.stat-item {
  text-align: center;
  padding: var(--sp-md) 0;
  background: var(--ink-mid);
  border-radius: var(--r-sm);
  border: 1px solid var(--border-faint);
}

.stat-value {
  color: var(--gold-bright);
  font-size: var(--fs-md);
  font-weight: 700;
}

.stat-label {
  color: var(--text-fade);
  font-size: var(--fs-xs);
  margin-top: 2px;
}

.record-row {
  display: flex;
  align-items: center;
  gap: var(--sp-sm);
  padding: var(--sp-sm) 0;
  border-bottom: 1px solid var(--border-faint);
}

.record-row:last-child { border-bottom: none; }

.delete-btn {
  margin-left: auto;
  color: var(--text-fade);
  font-size: var(--fs-xs);
}

/* H5 模式：rpx 转 rem 需要动态根字号 */
/* 设计稿宽度 750rpx，1rem = 100rpx */
html {
  font-size: 16px;
}

/* iPhone 6/7/8 (375px logical) */
@media screen and (width: 375px) {
  html { font-size: 50px; }
}

/* iPhone 6+/7+/8+ (414px logical) */
@media screen and (width: 414px) {
  html { font-size: 55.2px; }
}

/* 其他手机尺寸动态计算 */
@media screen and (min-width: 320px) and (max-width: 750px) {
  html {
    /* 基于视口宽度计算：fontSize = (vw / 750) * 100 */
    font-size: calc(100vw / 7.5);
  }
}

/* 平板及以上 */
@media screen and (min-width: 750px) {
  html { font-size: 100px; }
}

@media screen and (min-width: 960px) {
  html { font-size: 128px; }
}

/* H5 模式：让页面容器撑满视口 */
uni-page-body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* H5 模式：大屏适配 */
@media screen and (min-width: 768px) {
  uni-page-body {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 24px;
  }
}
</style>
