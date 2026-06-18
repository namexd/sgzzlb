<template>
  <view class="page account-page">
    <view class="account-bg"></view>

    <view class="profile-hero">
      <view class="avatar-wrap">
        <image class="avatar" src="/static/logo-ai-strategy-designed-appicon.png" mode="aspectFill" />
        <view class="vip-badge">V5</view>
      </view>
      <view class="profile-main">
        <view class="name-row">
          <text class="profile-name">{{ profileName }}</text>
        </view>
        <view class="profile-id">
          <text>ID：{{ profileId }}</text>
        </view>
        <view class="rank-badge">征战天下</view>
      </view>
      <view class="rank-card">风云将军</view>
    </view>

    <view class="subscription-card">
      <image class="sub-icon" src="/static/ui-assets/mockup-icons/account-subscription.png" mode="aspectFit" />
      <view class="sub-copy">
        <view class="sub-title">策略中枢</view>
        <view class="sub-state">{{ entitlements.tier === 'premium' ? '高级功能' : '阵容 · 抽卡 · 云端' }}</view>
        <view class="sub-date">策略数据中枢</view>
      </view>
      <view class="sub-action">
        <button class="benefit-btn" @tap="togglePremium({ detail: { value: entitlements.tier !== 'premium' } })">功能开关</button>
        <switch :checked="entitlements.tier === 'premium'" color="#d6a85d" @change="togglePremium" />
      </view>
      <view class="feature-grid">
        <view class="feature-item" @tap="loggedIn ? syncData() : goToLogin()">
          <image src="/static/ui-assets/mockup-icons/benefit-chest.png" mode="aspectFit" />
          <view>
            <text>云端存档</text>
            <text>{{ loggedIn ? '同步' : '登录' }}</text>
          </view>
        </view>
        <view class="feature-item" @tap="goToRecommend">
          <image src="/static/ui-assets/mockup-icons/benefit-speed.png" mode="aspectFit" />
          <view>
            <text>AI 配将</text>
            <text>配将</text>
          </view>
        </view>
        <view class="feature-item" @tap="goToDrawStats">
          <image src="/static/ui-assets/mockup-icons/benefit-resource.png" mode="aspectFit" />
          <view>
            <text>抽卡统计</text>
            <text>统计</text>
          </view>
        </view>
        <view class="feature-item" @tap="goToFeedback">
          <image src="/static/ui-assets/mockup-icons/benefit-service.png" mode="aspectFit" />
          <view>
            <text>反馈</text>
            <text>规划</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section-head">
      <view>阵容档案</view>
      <view class="head-action" @tap="goToRecommend">去配将 ›</view>
    </view>

    <view class="saved-list">
      <view v-for="item in lineupCards.slice(0, 3)" :key="item.id" :class="['saved-lineup', { preview: item.preview }]">
        <view class="thumbs">
          <view v-for="general in item.thumbnailGenerals" :key="general.name" class="thumb">
            <image v-if="general.imageUrl" :src="general.imageUrl" mode="aspectFill" />
            <text v-else>{{ general.name.slice(0, 1) }}</text>
          </view>
        </view>
        <view class="saved-info">
          <view class="saved-name">
            {{ item.name || item.generalsText || '未命名阵容' }}
            <text v-if="item.preview" class="saved-tag">推荐</text>
          </view>
          <view class="saved-sub">{{ item.scenario }} · {{ item.troop }} · {{ item.generalsText }}</view>
        </view>
        <view class="saved-score">
          <view>阵容评分</view>
          <text>{{ item.score || '-' }}</text>
        </view>
        <view class="saved-arrow" @tap.stop="item.preview ? goToAnalyze() : deleteLineup(item.id)">›</view>
      </view>
      <view class="create-lineup" @tap="goToAnalyze">＋ 创建新阵容</view>
    </view>

    <view v-if="optimizeHint" class="note">{{ optimizeHint }}</view>
    <view v-if="optimizeResult && optimizeResult.lineups.length" class="optimize-list">
      <view v-for="(lineup, idx) in optimizeResult.lineups" :key="lineup.priority" class="optimize-card">
        <view>
          <view class="saved-name">{{ lineup.role }}</view>
          <view class="saved-sub">{{ lineup.troop }} · {{ lineup.generals.join(' / ') }}</view>
        </view>
        <button class="mini-btn" @tap="saveOptimizeLineup(idx)">保存</button>
      </view>
    </view>

    <view class="tool-grid">
      <view class="tool-card" @tap="goToDrawStats">
        <image class="tool-icon" src="/static/ui-assets/mockup-icons/tool-draw.png" mode="aspectFit" />
        <view>抽卡统计</view>
        <text>›</text>
      </view>
      <view class="tool-card" @tap="goToFeedback">
        <image class="tool-icon" src="/static/ui-assets/mockup-icons/tool-chat.png" mode="aspectFit" />
        <view>意见反馈</view>
        <text>›</text>
      </view>
      <view class="tool-card" @tap="loggedIn ? syncData() : goToLogin()">
        <image class="tool-icon" src="/static/ui-assets/mockup-icons/tool-settings.png" mode="aspectFit" />
        <view>{{ loggedIn ? '同步数据' : '登录账号' }}</view>
        <text>›</text>
      </view>
    </view>

    <view class="account-actions">
      <button v-if="!loggedIn" class="mini-btn" @tap="goToLogin">登录 / 注册</button>
      <button v-if="loggedIn" class="mini-btn" @tap="syncData" :loading="syncing">同步数据</button>
      <button v-if="loggedIn" class="mini-btn danger" @tap="doLogout">退出登录</button>
    </view>

  </view>
</template>

<script>
import catalog from "../../utils/catalog";
import { getEntitlements, setTier, syncEntitlements } from "../../utils/subscription";
import { isLoggedIn, logout, getProfile, optimizeAccountAsync, deleteLineupAsync, requestRemote } from "../../services/api";

export default {
  data() {
    return {
      entitlements: { tier: "free" },
      loggedIn: false,
      userProfile: null,
      loginLoading: false,
      syncing: false,
      savedLineupsView: [],
      generalIds: [],
      tacticIds: [],
      inventorySummary: "未设置",
      optimizeLoading: false,
      optimizeHint: "",
      optimizeResult: null,
      meta: {}
    };
  },
  computed: {
    profileName() {
      if (this.loggedIn && this.userProfile) {
        return this.userProfile.nickname || this.userProfile.username || "乱世英雄";
      }
      return "乱世英雄";
    },

    profileId() {
      if (this.loggedIn && this.userProfile) {
        return this.userProfile.id || this.userProfile.userId || "12345678";
      }
      return "12345678";
    },

    lineupCards() {
      if (this.savedLineupsView.length) return this.savedLineupsView;
      return this.recommendedLineups();
    }
  },
  onShow() {
    this.refresh();
  },
  methods: {
    refresh() {
      this.loggedIn = isLoggedIn();
      this.entitlements = getEntitlements();
      this.meta = catalog.getMeta() || {};
      this.loadSaved();
      if (this.loggedIn) this.loadProfile();
    },
    loadProfile() {
      getProfile().then((d) => { this.userProfile = d; }).catch(() => {});
    },
    goToLogin() {
      uni.navigateTo({ url: "/pages/login/index" });
    },
    doLogout() {
      logout();
      this.loggedIn = false;
      this.userProfile = null;
      uni.showToast({ title: "已退出", icon: "success" });
    },
    async syncData() {
      if (!this.loggedIn) return;
      this.syncing = true;
      try {
        // Upload local lineups
        const savedLineups = uni.getStorageSync("savedLineups") || [];
        if (savedLineups.length > 0) {
          await requestRemote("/api/v1/lineups/sync", { method: "POST", data: { lineups: savedLineups } });
        }
        // Upload local draw records
        const drawPools = uni.getStorageSync("drawPools") || [];
        for (const pool of drawPools) {
          const records = uni.getStorageSync(`drawRecords_${pool.id}`) || [];
          if (records.length > 0) {
            await requestRemote("/api/v1/draw-records/sync", { method: "POST", data: { records } });
          }
        }
        // Download from server
        await this.loadFromCloud();
        uni.showToast({ title: "同步完成", icon: "success" });
      } catch (e) {
        uni.showToast({ title: "同步失败", icon: "none" });
      } finally {
        this.syncing = false;
      }
    },
    async loadFromCloud() {
      try {
        // Load lineups from server
        const lineupsRes = await requestRemote("/api/v1/lineups");
        const lineups = lineupsRes.items || [];
        if (lineups.length > 0) {
          const localLineups = uni.getStorageSync("savedLineups") || [];
          const localMap = new Map(localLineups.map(l => [l.id, l]));
          lineups.forEach(l => {
            if (!localMap.has(l.id)) {
              localLineups.push({
                id: l.id,
                createdAt: l.created_at,
                scenario: l.scenario,
                troop: l.troop,
                score: l.score,
                generals: typeof l.generals === 'string' ? JSON.parse(l.generals) : l.generals,
                tactics: typeof l.tactics === 'string' ? JSON.parse(l.tactics) : l.tactics
              });
            }
          });
          uni.setStorageSync("savedLineups", localLineups);
        }
        // Load draw records from server
        const drawRes = await requestRemote("/api/v1/draw-records");
        const records = drawRes.items || [];
        if (records.length > 0) {
          // Group by pool and merge
          const poolMap = {};
          records.forEach(r => {
            const poolId = r.pool_id || "default";
            if (!poolMap[poolId]) poolMap[poolId] = [];
            poolMap[poolId].push({
              id: r.id,
              poolId: r.pool_id,
              date: r.date,
              time: r.time,
              quality: r.quality,
              generalName: r.general_name,
              drawType: r.draw_type,
              group: r.group_num
            });
          });
          for (const [poolId, serverRecords] of Object.entries(poolMap)) {
            const localRecords = uni.getStorageSync(`drawRecords_${poolId}`) || [];
            const localIds = new Set(localRecords.map(r => r.id));
            serverRecords.forEach(r => {
              if (!localIds.has(r.id)) localRecords.push(r);
            });
            uni.setStorageSync(`drawRecords_${poolId}`, localRecords);
          }
        }
        this.loadSaved();
      } catch (e) {
        console.error("Load from cloud failed:", e);
      }
    },
    togglePremium(e) {
      setTier(e.detail.value ? "premium" : "free");
      this.entitlements = getEntitlements();
    },
    loadSaved() {
      const saved = uni.getStorageSync("savedLineups") || [];
      this.savedLineupsView = saved.map((item, index) => this.buildLineupView(item, index, false));
    },
    clearSaved() {
      uni.setStorageSync("savedLineups", []);
      this.savedLineupsView = [];
    },
    deleteLineup(id) {
      deleteLineupAsync(id).then(() => this.loadSaved());
    },
    previewOptimize() {
      if (this.generalIds.length < 3) { this.optimizeHint = "库存为空"; return; }
      this.optimizeLoading = true;
      this.optimizeHint = "";
      optimizeAccountAsync({ generalIds: this.generalIds, tacticIds: this.tacticIds, scenario: "pk" })
        .then((r) => { this.optimizeResult = r; this.optimizeLoading = false; })
        .catch((err) => { this.optimizeHint = "失败：" + err.message; this.optimizeLoading = false; });
    },
    saveOptimizeLineup(idx) {
      const lineup = this.optimizeResult.lineups[idx];
      if (!lineup) return;
      const saved = uni.getStorageSync("savedLineups") || [];
      const item = { id: `opt_${Date.now()}`, createdAt: new Date().toISOString(), scenario: "PK赛季", troop: lineup.troop, score: lineup.score, generals: lineup.generals, tactics: lineup.tactics };
      uni.setStorageSync("savedLineups", [item, ...saved]);
      this.loadSaved();
      uni.showToast({ title: "已保存", icon: "success" });
    },
    goToDrawStats() {
      uni.navigateTo({ url: "/pages/draw/stats" });
    },
    goToAnalyze() {
      uni.switchTab({ url: "/pages/analyze/index" });
    },
    goToRecommend() {
      uni.navigateTo({ url: "/pages/recommend/index" });
    },
    goToFeedback() {
      uni.navigateTo({ url: "/pages/feedback/index" });
    },
    resolveGeneral(value) {
      const text = String(value || "");
      const generals = catalog.getGenerals();
      const matched = generals.find((item) => item.id === text || item.name === text);
      if (!matched) return { name: text, imageUrl: "" };
      return {
        ...matched,
        imageUrl: matched.imageUrl || (matched.asset && matched.asset.imageUrl) || ""
      };
    },
    buildLineupView(item, index, preview) {
      const generals = (item.generals || []).slice(0, 3);
      const thumbnailGenerals = generals.map((name) => this.resolveGeneral(name));
      return {
        ...item,
        id: item.id || `lineup_${index}`,
        preview,
        name: item.name || item.role || "",
        generalsText: generals.map((name) => this.resolveGeneral(name).name || name).join(" / "),
        tacticsText: (item.tactics || []).join(" · "),
        thumbnailGenerals,
        scenario: item.scenario || "PK赛季",
        troop: item.troop || "自适应兵种",
        score: item.score || "-"
      };
    },
    recommendedLineups() {
      const samples = [
        { id: "recommend_taoyuan", name: "桃园结义", scenario: "推荐阵容", troop: "盾兵", score: 98560, generals: ["刘备", "关羽", "张飞"] },
        { id: "recommend_wei", name: "魏武之强", scenario: "推荐阵容", troop: "骑兵", score: 95230, generals: ["曹操", "贾诩", "郝昭"] },
        { id: "recommend_wu", name: "江东猛虎", scenario: "推荐阵容", troop: "弓兵", score: 93780, generals: ["孙权", "鲁肃", "凌统"] }
      ];
      return samples.map((item, index) => this.buildLineupView(item, index, true));
    }
  }
};
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  padding: var(--sp-lg);
  padding-bottom: 60rpx;
  background: linear-gradient(135deg, #0c0f14 0%, #1a1a2e 50%, #0a1628 100%);
  position: relative;
}

.account-page::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% 20%, rgba(201, 152, 58, 0.12) 0%, transparent 50%),
              radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}

.section {
  margin-bottom: var(--sp-lg);
}

.band {
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--r-lg);
  padding: var(--sp-lg);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  transition: all var(--ease);
  position: relative;
  overflow: hidden;
}

.band::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1rpx;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
}

.title {
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.subtitle {
  color: var(--text-stone);
  font-size: 24rpx;
  margin-top: var(--sp-xs);
  margin-bottom: var(--sp-md);
}

.card-title {
  color: var(--gold-bright);
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: var(--sp-sm);
}

.muted {
  color: var(--text-stone);
  font-size: 24rpx;
  line-height: 1.6;
}

.note {
  color: var(--text-fade);
  font-size: 22rpx;
  margin-top: 10rpx;
}

.empty {
  color: var(--text-fade);
  font-size: 24rpx;
  padding: 20rpx 0;
}

.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 14rpx;
}

.mini-btn {
  font-size: 24rpx;
  padding: 10rpx var(--sp-lg);
  background: rgba(201, 152, 58, 0.15);
  border: 1rpx solid rgba(201, 152, 58, 0.3);
  color: var(--gold-bright);
  border-radius: var(--r-md);
  line-height: 1.4;
  backdrop-filter: blur(5px);
  transition: all var(--ease);
}

.mini-btn:active {
  background: rgba(201, 152, 58, 0.25);
  transform: scale(0.98);
}

.btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: #ffffff;
  border-radius: var(--r-md);
  font-size: 28rpx;
  margin-top: var(--sp-md);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  transition: all var(--ease);
}

.btn:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  color: var(--text-ink);
  box-shadow: none;
}

.pill {
  background: rgba(201, 152, 58, 0.15);
  color: var(--gold-bright);
  font-size: 22rpx;
  padding: var(--sp-xxs) 14rpx;
  border-radius: var(--sp-xxs);
  border: 1rpx solid rgba(201, 152, 58, 0.3);
}

.saved-item {
  padding: var(--sp-md) 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}

.saved-item:last-child {
  border-bottom: none;
}

.saved-title {
  color: var(--text-ink);
  font-size: 26rpx;
  font-weight: 600;
}

.saved-actions {
  display: flex;
  gap: 14rpx;
  align-items: center;
}

.delete-btn {
  color: #ef4444;
  font-size: 22rpx;
}

.user-info {
  margin-bottom: var(--sp-sm);
}

.user-id {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}

.optimize-results {
  margin-top: 18rpx;
}

.optimize-lineup {
  margin-bottom: var(--sp-md);
  background: rgba(255, 255, 255, 0.04);
}

.lineup-role {
  color: #a5b4fc;
  font-size: 26rpx;
  font-weight: 600;
}

.lineup-score-pill {
  color: var(--gold-bright);
  font-size: 26rpx;
  font-weight: 700;
  background: rgba(201, 152, 58, 0.15);
  padding: 4rpx 12rpx;
  border-radius: var(--r-sm);
}

.lineup-info {
  margin-top: 10rpx;
}

.lineup-weakness {
  margin-top: var(--sp-xs);
}

.conflict-section {
  margin-top: 18rpx;
}

.conflict-item {
  padding: var(--sp-xs) 0;
}

.unused-section {
  margin-top: 18rpx;
}

.summary-section {
  margin-top: 14rpx;
}

.arrow {
  color: var(--text-stone);
  font-size: 28rpx;
}

.account-page {
  min-height: 100vh;
  padding: 82rpx 28rpx 148rpx;
  background:
    linear-gradient(180deg, rgba(13, 18, 25, 0.94), rgba(11, 15, 20, 0.98) 44%, #090c10 100%),
    linear-gradient(120deg, #101923 0%, #0e141c 52%, #24190d 100%);
  position: relative;
  overflow: hidden;
}

.account-page::before {
  display: none;
}

.account-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 68% 16%, rgba(214, 168, 93, 0.16), transparent 32%),
    radial-gradient(circle at 16% 70%, rgba(214, 168, 93, 0.08), transparent 35%),
    linear-gradient(180deg, rgba(61, 73, 88, 0.08), transparent 38%);
  pointer-events: none;
  z-index: 0;
}

.profile-hero,
.subscription-card,
.section-head,
.saved-list,
.optimize-list,
.tool-grid,
.account-actions,
.data-note,
.note {
  position: relative;
  z-index: 1;
}

.profile-hero {
  display: grid;
  grid-template-columns: 168rpx 1fr 170rpx;
  gap: 22rpx;
  align-items: center;
  margin-bottom: 34rpx;
}

.avatar-wrap {
  position: relative;
  width: 154rpx;
  height: 154rpx;
}

.avatar {
  width: 154rpx;
  height: 154rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(218, 185, 111, 0.7);
  box-shadow: 0 0 28rpx rgba(218, 185, 111, 0.22);
}

.vip-badge {
  position: absolute;
  left: 38rpx;
  right: 38rpx;
  bottom: -8rpx;
  height: 34rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, #7a5a27, #2c2112);
  border: 1rpx solid rgba(245, 221, 156, 0.62);
  color: #f5dda0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 22rpx;
}

.profile-main {
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.profile-name {
  color: #eadcc8;
  font-size: 34rpx;
  font-weight: 900;
}

.profile-id {
  color: #a8adb4;
  font-size: 24rpx;
  margin-top: 12rpx;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  height: 42rpx;
  margin-top: 14rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  color: #d6b978;
  background: rgba(214, 168, 93, 0.12);
  border: 1rpx solid rgba(214, 168, 93, 0.18);
  font-size: 24rpx;
}

.rank-card {
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0d8a4;
  font-size: 26rpx;
  font-weight: 900;
  background: linear-gradient(180deg, rgba(87, 60, 26, 0.5), rgba(34, 26, 17, 0.72));
  border: 1rpx solid rgba(214, 168, 93, 0.28);
  border-radius: 8rpx;
}

.subscription-card {
  padding: 30rpx 30rpx 28rpx;
  margin-bottom: 34rpx;
  display: grid;
  grid-template-columns: 104rpx 1fr 156rpx;
  gap: 20rpx;
  border-radius: 14rpx;
  border: 1rpx solid rgba(220, 230, 238, 0.2);
  background:
    linear-gradient(145deg, rgba(75, 86, 94, 0.58), rgba(31, 39, 47, 0.74) 48%, rgba(20, 25, 31, 0.86)),
    linear-gradient(90deg, rgba(230, 213, 166, 0.12), rgba(255, 255, 255, 0.02));
  box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.36), inset 0 0 36rpx rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(16px);
}

.sub-icon {
  width: 94rpx;
  height: 94rpx;
  border-radius: 50%;
  display: block;
  filter: drop-shadow(0 0 14rpx rgba(214, 168, 93, 0.32));
}

.sub-title {
  color: #eadcc8;
  font-size: 34rpx;
  font-weight: 900;
}

.sub-state {
  color: #eadcc8;
  font-size: 26rpx;
  margin-top: 8rpx;
}

.sub-date {
  color: #9da2a8;
  font-size: 23rpx;
  margin-top: 14rpx;
  line-height: 1.35;
}

.sub-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16rpx;
}

.benefit-btn {
  min-width: 126rpx;
  height: 54rpx;
  border-radius: 999rpx;
  color: #4c3516;
  font-size: 24rpx;
  background: linear-gradient(180deg, #f2d99d, #c1964a);
}

.feature-grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
}

.feature-item {
  min-height: 112rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: #d4bf92;
  text-align: center;
  border-right: 1rpx solid rgba(255, 255, 255, 0.1);
}

.feature-item:last-child {
  border-right: 0;
}

.feature-item image {
  width: 42rpx;
  height: 42rpx;
  display: block;
}

.feature-item view {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.feature-item text:first-child {
  color: #d6b978;
  font-size: 23rpx;
  font-weight: 900;
}

.feature-item text:last-child {
  color: #d4c4a4;
  font-size: 20rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #eadcc8;
  font-size: 32rpx;
  font-weight: 900;
  margin: 0 0 18rpx;
  padding-left: 12rpx;
  border-left: 6rpx solid #d6a85d;
}

.head-action {
  color: #9399a1;
  font-size: 24rpx;
  font-weight: 500;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-bottom: 28rpx;
}

.saved-lineup,
.create-lineup,
.optimize-card {
  min-height: 112rpx;
  border-radius: 8rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.055);
  display: grid;
  grid-template-columns: 222rpx minmax(0, 1fr) 120rpx 24rpx;
  gap: 14rpx;
  align-items: center;
  padding: 12rpx;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6rpx;
}

.thumb {
  height: 88rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.28);
  color: #d6b978;
  background: linear-gradient(160deg, #28303a, #121820);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  overflow: hidden;
}

.thumb image {
  width: 100%;
  height: 100%;
  display: block;
}

.thumb text {
  font-size: 30rpx;
}

.saved-info {
  min-width: 0;
}

.saved-name {
  color: #eadcc8;
  font-size: 27rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-tag {
  flex-shrink: 0;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  color: #86d598;
  background: rgba(51, 142, 77, 0.22);
  font-size: 18rpx;
  font-weight: 700;
}

.saved-sub {
  color: #969ca5;
  font-size: 22rpx;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-score {
  text-align: right;
  color: #90969f;
  font-size: 22rpx;
}

.saved-score text {
  color: #d6a85d;
  font-size: 31rpx;
  font-weight: 900;
}

.saved-arrow {
  color: #b9a982;
  font-size: 44rpx;
}

.create-lineup {
  grid-template-columns: 1fr;
  justify-content: center;
  color: #888f98;
  font-size: 28rpx;
  text-align: center;
}

.optimize-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.optimize-card {
  grid-template-columns: 1fr 112rpx;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22rpx;
  margin-bottom: 28rpx;
}

.tool-card {
  min-height: 174rpx;
  border-radius: 10rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.055);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: #eadcc8;
  font-size: 26rpx;
}

.tool-icon {
  color: #d6b978;
  font-size: 40rpx;
  font-weight: 900;
}

.tool-card text {
  color: #a99b83;
  font-size: 28rpx;
}

.account-actions {
  display: flex;
  gap: 14rpx;
  justify-content: center;
  margin-bottom: 22rpx;
}

.mini-btn {
  min-height: 54rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.28);
  background: rgba(214, 168, 93, 0.1);
  color: #d6b978;
  font-size: 24rpx;
}

.mini-btn.danger {
  color: #d1684d;
  border-color: rgba(209, 104, 77, 0.26);
  background: rgba(209, 104, 77, 0.08);
}

.data-note,
.note {
  color: #858c96;
  font-size: 23rpx;
  text-align: center;
  line-height: 1.5;
}

.empty {
  color: #858c96;
  padding: 40rpx 0;
}

.account-page {
  background:
    radial-gradient(circle at 72% 2%, rgba(214, 168, 93, 0.22), transparent 32%),
    radial-gradient(circle at 8% 32%, rgba(120, 148, 178, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(13, 18, 25, 0.94), rgba(11, 15, 20, 0.98) 44%, #090c10 100%),
    linear-gradient(120deg, #101923 0%, #0e141c 52%, #24190d 100%);
}

.profile-name,
.sub-title,
.section-head {
  text-shadow: 0 0 16rpx rgba(214, 168, 93, 0.16), 0 6rpx 14rpx rgba(0, 0, 0, 0.42);
}

.avatar {
  box-shadow:
    0 0 0 2rpx rgba(255, 235, 170, 0.18),
    0 0 28rpx rgba(218, 185, 111, 0.28),
    inset 0 0 18rpx rgba(255, 235, 170, 0.1);
}

.rank-card,
.rank-badge,
.vip-badge {
  box-shadow: inset 0 1rpx 0 rgba(255, 245, 190, 0.28), 0 8rpx 18rpx rgba(0, 0, 0, 0.24);
}

.subscription-card {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    linear-gradient(145deg, rgba(136, 149, 156, 0.34), rgba(58, 69, 78, 0.48) 46%, rgba(28, 35, 43, 0.62)) padding-box,
    linear-gradient(135deg, rgba(255, 246, 204, 0.5), rgba(235, 242, 248, 0.14) 44%, rgba(214, 168, 93, 0.42)) border-box;
  border: 1rpx solid transparent;
  box-shadow:
    0 14rpx 34rpx rgba(0, 0, 0, 0.34),
    0 0 18rpx rgba(214, 168, 93, 0.08),
    inset 0 0 0 1rpx rgba(255, 255, 255, 0.12),
    inset 0 0 0 8rpx rgba(255, 255, 255, 0.018),
    inset 0 -22rpx 42rpx rgba(0, 0, 0, 0.16);
}

.subscription-card > * {
  position: relative;
  z-index: 2;
}

.subscription-card::before {
  content: "";
  position: absolute;
  inset: 10rpx;
  pointer-events: none;
  z-index: 1;
  border-radius: 10rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(90deg, rgba(236, 204, 128, 0.8) 0 28rpx, transparent 28rpx) left top / 76rpx 2rpx no-repeat,
    linear-gradient(rgba(236, 204, 128, 0.8) 0 28rpx, transparent 28rpx) left top / 2rpx 76rpx no-repeat,
    linear-gradient(270deg, rgba(236, 204, 128, 0.8) 0 28rpx, transparent 28rpx) right top / 76rpx 2rpx no-repeat,
    linear-gradient(rgba(236, 204, 128, 0.8) 0 28rpx, transparent 28rpx) right top / 2rpx 76rpx no-repeat,
    linear-gradient(90deg, rgba(236, 204, 128, 0.58) 0 28rpx, transparent 28rpx) left bottom / 76rpx 2rpx no-repeat,
    linear-gradient(0deg, rgba(236, 204, 128, 0.58) 0 28rpx, transparent 28rpx) left bottom / 2rpx 76rpx no-repeat,
    linear-gradient(270deg, rgba(236, 204, 128, 0.58) 0 28rpx, transparent 28rpx) right bottom / 76rpx 2rpx no-repeat,
    linear-gradient(0deg, rgba(236, 204, 128, 0.58) 0 28rpx, transparent 28rpx) right bottom / 2rpx 76rpx no-repeat;
  opacity: 0.72;
}

.subscription-card::after {
  content: "";
  position: absolute;
  left: 18rpx;
  right: 18rpx;
  top: 10rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), rgba(236, 204, 128, 0.34), transparent);
  pointer-events: none;
  z-index: 1;
}

.sub-icon,
.feature-item text:first-child,
.tool-icon {
  text-shadow: 0 0 16rpx rgba(214, 168, 93, 0.28);
}

.sub-icon {
  box-shadow: none;
}

.benefit-btn,
.mini-btn {
  box-shadow:
    0 10rpx 22rpx rgba(0, 0, 0, 0.28),
    inset 0 1rpx 0 rgba(255, 245, 190, 0.42),
    inset 0 -8rpx 16rpx rgba(82, 51, 19, 0.18);
}

.saved-lineup,
.create-lineup,
.optimize-card,
.tool-card {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.028)) padding-box,
    linear-gradient(135deg, rgba(255, 255, 255, 0.13), rgba(214, 168, 93, 0.22)) border-box;
  border: 1rpx solid transparent;
  box-shadow:
    0 14rpx 30rpx rgba(0, 0, 0, 0.28),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12),
    inset 0 -18rpx 28rpx rgba(0, 0, 0, 0.16);
}

.saved-lineup::before,
.create-lineup::before,
.tool-card::before {
  content: "";
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  top: 0;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(214, 168, 93, 0.58), transparent);
  pointer-events: none;
}

.saved-lineup::after,
.tool-card::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(125deg, rgba(255, 255, 255, 0.08), transparent 32%);
}

.thumb {
  border: 0;
  background:
    linear-gradient(#151d27, #151d27) padding-box,
    linear-gradient(145deg, rgba(230, 194, 126, 0.72), rgba(93, 110, 132, 0.3)) border-box;
  border: 1rpx solid transparent;
  box-shadow: inset 0 0 12rpx rgba(214, 168, 93, 0.1), 0 8rpx 14rpx rgba(0, 0, 0, 0.24);
}

.tool-card {
  transform: translateZ(0);
}

.tool-card:active,
.saved-lineup:active,
.create-lineup:active {
  transform: scale(0.985);
}

.profile-id {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.rank-badge {
  gap: 8rpx;
}

.sub-icon {
  padding: 0;
  border: 0;
  background: transparent;
}

.feature-item image {
  width: 42rpx;
  height: 42rpx;
  display: block;
  mix-blend-mode: screen;
  filter: brightness(1.2) contrast(1.08);
}

.saved-arrow {
  color: #b9a982;
  font-size: 44rpx;
  line-height: 1;
}

.tool-icon {
  width: 58rpx;
  height: 58rpx;
  display: block;
  mix-blend-mode: screen;
  filter: brightness(1.18) contrast(1.08);
}
</style>
