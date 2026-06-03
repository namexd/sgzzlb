<template>
  <view class="page account-page">
    <view class="section">
      <view class="title">我的分析台</view>
      <view class="subtitle">管理订阅状态、保存阵容和账号级共存分析。</view>
    </view>

    <view class="section band">
      <view class="card-title">账号</view>
      <view v-if="loggedIn && userProfile" class="user-info">
        <view class="user-id">{{ userProfile.nickname || userProfile.username || userProfile.id }}</view>
        <view class="muted">保存阵容 {{ userProfile.lineupCount }} 套 · 抽卡记录 {{ userProfile.drawCount }} 条</view>
      </view>
      <view v-else-if="loggedIn" class="muted">已登录，正在加载用户信息...</view>
      <view v-else class="muted">未登录。登录后数据可云端同步。</view>
      <view class="config-actions">
        <button v-if="!loggedIn" class="mini-btn" @tap="goToLogin">登录 / 注册</button>
        <button v-if="loggedIn" class="mini-btn" @tap="syncData" :loading="syncing">同步数据</button>
        <button v-if="loggedIn" class="mini-btn" @tap="doLogout">退出登录</button>
      </view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view>
          <view class="card-title">订阅状态</view>
          <view class="muted">{{ entitlements.tier === 'premium' ? '高级订阅已启用' : '当前为免费层' }}</view>
        </view>
        <switch :checked="entitlements.tier === 'premium'" color="#d6a85d" @change="togglePremium" />
      </view>
    </view>

    <view class="section band" @tap="goToDrawStats">
      <view class="row-between">
        <view>
          <view class="card-title">抽卡统计</view>
          <view class="muted">查看抽卡概率、月度趋势和橙卡记录</view>
        </view>
        <view class="arrow">→</view>
      </view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view class="card-title">保存阵容</view>
        <button class="mini-btn" @tap="clearSaved">清空</button>
      </view>
      <view v-if="!savedLineupsView.length" class="empty">还没有保存阵容。先去评分页生成并保存。</view>
      <view v-for="item in savedLineupsView" :key="item.id" class="saved-item">
        <view class="row-between">
          <view class="saved-title">{{ item.generalsText }}</view>
          <view class="saved-actions">
            <text class="pill">{{ item.score }}</text>
            <text class="delete-btn" @tap="deleteLineup(item.id)">删除</text>
          </view>
        </view>
        <view class="muted">{{ item.scenario }} · {{ item.troop }}</view>
        <view class="muted small">{{ item.tacticsText }}</view>
      </view>
    </view>

    <view class="section band">
      <view class="row-between">
        <view>
          <view class="card-title">账号级共存分析</view>
          <view class="muted">库存：{{ inventorySummary }}</view>
        </view>
      </view>
      <button class="btn secondary" @tap="previewOptimize" :loading="optimizeLoading" :disabled="optimizeLoading">生成共存方案</button>
      <view v-if="optimizeHint" class="note">{{ optimizeHint }}</view>

      <view v-if="optimizeResult && optimizeResult.lineups.length" class="optimize-results">
        <view v-for="(lineup, idx) in optimizeResult.lineups" :key="lineup.priority" class="optimize-lineup band">
          <view class="row-between">
            <view class="lineup-role">{{ lineup.role }}</view>
            <view class="lineup-score-pill">{{ lineup.score }} 分</view>
          </view>
          <view class="lineup-info">
            <view class="muted">{{ lineup.troop }} · {{ lineup.generals.join(' / ') }}</view>
            <view class="muted small">{{ lineup.tactics.join(' · ') }}</view>
          </view>
          <view v-if="lineup.weaknesses.length" class="lineup-weakness">
            <text class="muted">短板：{{ lineup.weaknesses[0] }}</text>
          </view>
          <button class="mini-btn" @tap="saveOptimizeLineup(idx)">保存此队</button>
        </view>

        <view v-if="optimizeResult.conflicts.length" class="conflict-section">
          <view class="card-title">战法冲突</view>
          <view v-for="c in optimizeResult.conflicts" :key="c.tacticName" class="conflict-item">
            <text class="muted">{{ c.tacticName }}：{{ c.usedBy.join(' 和 ') }} 共用</text>
          </view>
        </view>

        <view v-if="optimizeResult.unused.generals.length || optimizeResult.unused.tactics.length" class="unused-section">
          <view class="card-title">剩余库存</view>
          <view v-if="optimizeResult.unused.generals.length" class="muted">未编入武将：{{ optimizeResult.unused.generals.map(g => g.name).join('、') }} 等 {{ optimizeResult.unused.generals.length }} 名</view>
          <view v-if="optimizeResult.unused.tactics.length" class="muted">未编入战法：{{ optimizeResult.unused.tactics.map(t => t.name).join('、') }} 等 {{ optimizeResult.unused.tactics.length }} 个</view>
        </view>

        <view v-if="optimizeResult.summary" class="summary-section">
          <view class="muted">共 {{ optimizeResult.summary.totalLineups }} 队，总分 {{ optimizeResult.summary.totalScore }}，均分 {{ optimizeResult.summary.averageScore }}</view>
        </view>
      </view>
    </view>

    <view class="section band" @tap="goToFeedback">
      <view class="row-between">
        <view>
          <view class="card-title">意见反馈</view>
          <view class="muted">功能建议、使用问题或优化需求</view>
        </view>
        <view class="arrow">→</view>
      </view>
    </view>

    <view class="section band">
      <view class="card-title">数据快照</view>
      <view class="note">武将 {{ meta.generalsCount }}，战法 {{ meta.tacticsCount }}，装备 {{ meta.equipmentCount }}，兵种 {{ meta.troopTacticsCount }}。</view>
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
      this.savedLineupsView = saved.map((item) => ({ ...item, generalsText: (item.generals || []).join(" / "), tacticsText: (item.tactics || []).join(" · ") }));
    },
    clearSaved() {
      uni.setStorageSync("savedLineups", []);
      this.savedLineupsView = [];
    },
    deleteLineup(id) {
      deleteLineupAsync(id).then(() => this.loadSaved());
    },
    previewOptimize() {
      if (this.generalIds.length < 3) { this.optimizeHint = "请先导入库存。"; return; }
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
    goToFeedback() {
      uni.navigateTo({ url: "/pages/feedback/index" });
    }
  }
};
</script>

<style scoped>
.account-page { min-height: 100vh; padding: var(--sp-lg); padding-bottom: 60rpx; }
.section { margin-bottom: var(--sp-lg); }
.band { background: var(--ink-surface); border-radius: var(--r-md); padding: var(--sp-lg); border: 1rpx solid var(--border-faint); box-shadow: var(--shadow-sm); transition: box-shadow var(--ease); }
.title { color: var(--gold-bright); font-size: 36rpx; font-weight: 700; }
.subtitle { color: var(--text-stone); font-size: 24rpx; margin-top: var(--sp-xs); margin-bottom: var(--sp-md); }
.card-title { color: var(--gold-bright); font-size: 28rpx; font-weight: 600; margin-bottom: var(--sp-sm); }
.muted { color: var(--text-stone); font-size: 24rpx; line-height: 1.6; }
.note { color: var(--text-fade); font-size: 22rpx; margin-top: 10rpx; }
.empty { color: var(--text-fade); font-size: 24rpx; padding: 20rpx 0; }
.row-between { display: flex; justify-content: space-between; align-items: center; }
.config-actions { display: flex; gap: 14rpx; margin-top: 14rpx; }
.mini-btn { font-size: 24rpx; padding: 10rpx var(--sp-lg); background: var(--gold-ghost); border: 1rpx solid var(--border-accent); color: var(--gold); border-radius: var(--r-sm); line-height: 1.4; transition: all var(--ease); }
.btn { background: var(--gold-ghost); border: 1rpx solid var(--gold); color: var(--gold); border-radius: var(--r-md); font-size: 28rpx; margin-top: var(--sp-md); transition: all var(--ease); }
.btn.secondary { background: var(--ink-surface); border-color: var(--border-subtle); color: var(--text-ink); }
.pill { background: var(--gold-ghost); color: var(--gold); font-size: 22rpx; padding: var(--sp-xxs) 14rpx; border-radius: var(--sp-xxs); }
.saved-item { padding: var(--sp-md) 0; border-bottom: 1rpx solid var(--border-faint); }
.saved-title { color: var(--text-ink); font-size: 26rpx; font-weight: 600; }
.saved-actions { display: flex; gap: 14rpx; align-items: center; }
.delete-btn { color: var(--loss); font-size: 22rpx; }
.user-info { margin-bottom: var(--sp-sm); }
.user-id { color: var(--text-ink); font-size: 26rpx; }
.optimize-results { margin-top: 18rpx; }
.optimize-lineup { margin-bottom: var(--sp-md); }
.lineup-role { color: var(--gold); font-size: 26rpx; font-weight: 600; }
.lineup-score-pill { color: var(--gold-bright); font-size: 26rpx; font-weight: 700; }
.lineup-info { margin-top: 10rpx; }
.lineup-weakness { margin-top: var(--sp-xs); }
.conflict-section { margin-top: 18rpx; }
.conflict-item { padding: var(--sp-xs) 0; }
.unused-section { margin-top: 18rpx; }
.summary-section { margin-top: 14rpx; }
.arrow { color: var(--text-stone); font-size: 28rpx; }
</style>
