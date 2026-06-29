<template>
  <view class="page history-page">
    <view class="history-bg"></view>
    <view class="history-header">
      <view class="back-btn" @tap="goBack">‹</view>
      <view>
        <view class="page-title">推荐复盘</view>
        <view class="page-subtitle">历史方案 · 模拟复核 · 反馈状态</view>
      </view>
      <view class="mode-pill">{{ detail ? '详情' : '列表' }}</view>
    </view>

    <view v-if="!detail" class="panel">
      <view class="panel-title">推荐历史</view>
      <view v-if="!history.length" class="empty-line">暂无推荐历史，请先在智能配将页生成推荐。</view>
      <view v-for="item in history" :key="item.id" class="history-card" @tap="openDetail(item.id)">
        <view class="history-top">
          <view>
            <view class="history-title">{{ item.scenario || '推荐方案' }} · {{ item.lineups.length }} 队</view>
            <view class="muted">{{ formatDate(item.createdAt) }} · 目标 {{ item.targetLineupCount || '-' }} 队</view>
          </view>
          <view class="score-badge">{{ item.summary && item.summary.averageScore || '-' }}</view>
        </view>
        <view class="muted">{{ lineupSummary(item) }}</view>
      </view>
    </view>

    <view v-else class="panel">
      <view class="panel-title">{{ detail.scenario }} · {{ formatDate(detail.createdAt) }}</view>
      <view class="muted">库存：{{ detail.input.generalIds.length }} 名武将 / {{ detail.input.tacticIds.length }} 个战法 · 目标 {{ detail.targetLineupCount }} 队</view>
      <view v-if="catalogContextText" class="muted">资料版本：{{ catalogContextText }}</view>
      <view v-if="detail.warnings && detail.warnings.length" class="notice-box">
        <view class="mini-title">提示</view>
        <view v-for="warning in detail.warnings" :key="warning" class="muted">{{ warning }}</view>
      </view>

      <view v-for="lineup in detail.lineups" :key="lineup.key" class="lineup-card">
        <view class="history-top">
          <view>
            <view class="history-title">{{ lineup.role || ('第 ' + lineup.rank + ' 队') }} · {{ lineup.troop }}</view>
            <view class="muted">{{ lineup.generals.join(' / ') }}</view>
          </view>
          <view class="score-badge">{{ lineup.score }}</view>
        </view>
        <view class="name-grid">
          <view v-for="name in lineup.tactics" :key="name" class="name-cell">{{ name }}</view>
        </view>
        <view v-if="lineup.reasons && lineup.reasons.length" class="info-list">
          <view v-for="reason in lineup.reasons.slice(0, 2)" :key="reason">· {{ reason }}</view>
        </view>
        <view v-if="lineup.weaknesses && lineup.weaknesses.length" class="weakness-list">
          <view v-for="weakness in lineup.weaknesses.slice(0, 2)" :key="weakness">短板：{{ weakness }}</view>
        </view>
        <view v-if="lineup.alternatives && lineup.alternatives.length" class="notice-box">
          <view class="mini-title">替代建议</view>
          <view v-for="item in lineup.alternatives.slice(0, 3)" :key="item.id || item.name" class="muted">{{ item.name }} · {{ item.reason }}</view>
        </view>
        <view v-if="lineup.simulation" class="notice-box">
          <view class="mini-title">模拟复核</view>
          <view class="coverage-grid">
            <view class="coverage-item"><text>胜率</text><strong>{{ formatPercent(lineup.simulation.summary && lineup.simulation.summary.winRate) }}</strong></view>
            <view class="coverage-item"><text>场次</text><strong>{{ lineup.simulation.summary && lineup.simulation.summary.iterations }}</strong></view>
            <view class="coverage-item"><text>稳定性</text><strong>{{ lineup.simulation.aggregate && lineup.simulation.aggregate.stability }}</strong></view>
          </view>
        </view>
        <view v-if="lineup.feedback" class="notice-box">
          <view class="mini-title">反馈状态</view>
          <view class="muted">{{ lineup.feedback.rating === 'good' ? '有帮助' : '不适合' }} · {{ lineup.feedback.reason || '未填写' }}{{ lineup.feedback.pending ? ' · 待同步' : '' }}</view>
        </view>
        <view class="card-actions">
          <button class="mini-btn" @tap.stop="saveLineup(lineup)">保存阵容</button>
          <button class="mini-btn" @tap.stop="goToAnalyze(lineup)">去评分</button>
          <button class="mini-btn" @tap.stop="goToMatchup(lineup)">去对位</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { setStorage } from "../../utils/storage";
import { getRecommendationHistoryAsync, saveLineupAsync, isRemoteMode } from "../../services/api";

export default {
  data() {
    return {
      history: [],
      detailId: "",
      isRemote: false
    };
  },
  computed: {
    detail() {
      return this.detailId ? this.history.find((item) => item.id === this.detailId) : null;
    },
    catalogContextText() {
      const ctx = this.detail && this.detail.catalogContext;
      if (!ctx) return "";
      return [ctx.season || ctx.seasonKey, ctx.versionKey || ctx.catalogVersionId, ctx.status].filter(Boolean).join(" · ");
    }
  },
  onLoad(query = {}) {
    this.detailId = query.id || "";
    this.isRemote = isRemoteMode();
    this.loadHistory();
  },
  onShow() {
    this.isRemote = isRemoteMode();
    this.loadHistory();
  },
  methods: {
    async loadHistory() {
      this.history = await getRecommendationHistoryAsync().catch(() => []);
    },
    openDetail(id) {
      uni.navigateTo({ url: `/pages/recommend/history?id=${id}` });
    },
    formatDate(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (num) => String(num).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },
    lineupSummary(item) {
      return (item.lineups || []).slice(0, 2).map((lineup) => (lineup.generals || []).join(" / ")).join("；") || "暂无阵容摘要";
    },
    formatPercent(value) {
      if (value === undefined || value === null || Number.isNaN(Number(value))) return "-";
      const number = Number(value);
      return number <= 1 ? `${Math.round(number * 100)}%` : `${Math.round(number)}%`;
    },
    buildSavedLineup(lineup) {
      return {
        id: `history_${Date.now()}_${lineup.rank || 1}`,
        createdAt: new Date().toISOString(),
        name: `历史推荐${lineup.rank || ''}`,
        source: "recommendation-history",
        scenario: this.detail.scenario,
        scenarioId: this.detail.scenarioId,
        troop: lineup.troop,
        score: lineup.score,
        generals: lineup.generals || [],
        generalIds: lineup.generalIds || [],
        tactics: lineup.tactics || [],
        tacticIds: lineup.tacticIds || [],
        catalogContext: this.detail.catalogContext || null
      };
    },
    async saveLineup(lineup) {
      const item = this.buildSavedLineup(lineup);
      try {
        await saveLineupAsync({ lineup: item });
        uni.showToast({ title: "已保存到数据库", icon: "success" });
      } catch (error) {
        uni.showToast({ title: error.message || "保存失败", icon: "none" });
      }
    },
    goToAnalyze(lineup) {
      setStorage("pendingAnalyzeLineup", this.buildSavedLineup(lineup));
      uni.switchTab({ url: "/pages/analyze/index" });
    },
    goToMatchup(lineup) {
      const item = this.buildSavedLineup(lineup);
      setStorage("pendingMatchupLineup", item);
      setStorage("pendingMatchupAction", "preview");
      uni.switchTab({ url: "/pages/matchup/index" });
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: "/pages/account/index" }) });
    }
  }
};
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  padding: var(--sp-lg);
  padding-bottom: 80rpx;
  background: linear-gradient(135deg, #0c0f14 0%, #1a1a2e 52%, #0a1628 100%);
  color: #fff;
}
.history-bg { position: fixed; inset: 0; background: radial-gradient(circle at 50% 18%, rgba(214, 168, 93, 0.14), transparent 45%); pointer-events: none; }
.history-header, .panel, .history-card, .lineup-card, .notice-box { position: relative; z-index: 1; }
.history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-lg); }
.back-btn { width: 64rpx; height: 64rpx; border-radius: 50%; background: rgba(255,255,255,.08); text-align: center; line-height: 58rpx; font-size: 54rpx; color: #f6d58d; }
.page-title { font-size: 40rpx; font-weight: 800; }
.page-subtitle, .muted, .empty-line { color: var(--text-stone); font-size: 24rpx; }
.panel, .history-card, .lineup-card, .notice-box { margin-bottom: var(--sp-md); padding: var(--sp-lg); border-radius: var(--r-lg); background: rgba(255,255,255,.07); border: 1rpx solid rgba(255,255,255,.1); }
.panel-title, .history-title, .mini-title { color: #f6d58d; font-size: 30rpx; font-weight: 700; }
.history-top, .card-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-sm); }
.score-badge, .mode-pill { color: #2b1b05; background: linear-gradient(135deg, #f5d27a, #d6a85d); border-radius: 999rpx; padding: 10rpx 18rpx; font-weight: 700; }
.name-grid, .info-list, .weakness-list { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: var(--sp-md); }
.name-cell { padding: 12rpx 18rpx; border-radius: var(--r-sm); background: rgba(255,255,255,.08); font-size: 24rpx; }
.weakness-list { color: #fca5a5; font-size: 24rpx; }
.mini-btn { margin: 0; padding: 0 18rpx; height: 58rpx; line-height: 58rpx; border: 0; border-radius: 999rpx; color: #2b1b05; background: linear-gradient(135deg, #f5d27a, #d6a85d); font-size: 22rpx; font-weight: 700; }
.coverage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; margin-top: var(--sp-sm); }
.coverage-item { padding: 12rpx; border-radius: var(--r-sm); background: rgba(255,255,255,.07); text-align: center; }
.coverage-item text { display: block; color: var(--text-stone); font-size: 20rpx; }
.coverage-item strong { display: block; color: #f6d58d; font-size: 26rpx; }
</style>
