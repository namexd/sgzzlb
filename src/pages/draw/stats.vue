<template>
  <view class="page stats-page">
    <view class="section header">
      <view class="back-btn" @tap="goBack">← 返回</view>
      <view class="title">抽卡统计</view>
    </view>

    <!-- Season selector -->
    <view class="section">
      <view class="season-tabs">
        <view :class="['season-tab', { active: viewMode === 'current' }]" @tap="viewMode = 'current'; refreshStats()">
          当前赛季
        </view>
        <view :class="['season-tab', { active: viewMode === 'all' }]" @tap="viewMode = 'all'; refreshStats()">
          全部记录
        </view>
      </view>
    </view>

    <!-- Overview cards -->
    <view class="section overview-grid">
      <view class="overview-card">
        <view class="card-value">{{ stats.totalDraws }}</view>
        <view class="card-label">总抽卡</view>
      </view>
      <view class="overview-card orange">
        <view class="card-value">{{ stats.orangeCount }}</view>
        <view class="card-label">橙卡</view>
      </view>
      <view class="overview-card purple">
        <view class="card-value">{{ stats.purpleCount }}</view>
        <view class="card-label">紫卡</view>
      </view>
      <view class="overview-card blue">
        <view class="card-value">{{ stats.blueCount }}</view>
        <view class="card-label">蓝卡</view>
      </view>
    </view>

    <!-- Rate card -->
    <view class="section rate-card">
      <view class="rate-header">
        <view class="rate-title">出橙概率</view>
        <view class="rate-value">{{ stats.orangeRate }}%</view>
      </view>
      <view class="rate-bar">
        <view class="rate-fill" :style="{ width: stats.orangeRate + '%' }"></view>
      </view>
      <view class="rate-desc">
        平均每 {{ stats.orangeCount > 0 ? Math.round(stats.totalDraws / stats.orangeCount) : '-' }} 抽出一张橙卡
      </view>
    </view>

    <!-- Draw type breakdown -->
    <view class="section breakdown-card">
      <view class="breakdown-title">抽卡类型</view>
      <view class="breakdown-grid">
        <view class="breakdown-item">
          <view class="breakdown-label">免费抽</view>
          <view class="breakdown-value">{{ stats.freeDraws }}</view>
          <view class="breakdown-percent">{{ stats.totalDraws > 0 ? (stats.freeDraws / stats.totalDraws * 100).toFixed(0) : 0 }}%</view>
        </view>
        <view class="breakdown-item">
          <view class="breakdown-label">半价抽</view>
          <view class="breakdown-value">{{ stats.halfDraws }}</view>
          <view class="breakdown-percent">{{ stats.totalDraws > 0 ? (stats.halfDraws / stats.totalDraws * 100).toFixed(0) : 0 }}%</view>
        </view>
        <view class="breakdown-item">
          <view class="breakdown-label">第一组</view>
          <view class="breakdown-value">{{ stats.byGroup.group1 }}</view>
          <view class="breakdown-percent">{{ stats.totalDraws > 0 ? (stats.byGroup.group1 / stats.totalDraws * 100).toFixed(0) : 0 }}%</view>
        </view>
        <view class="breakdown-item">
          <view class="breakdown-label">第二组</view>
          <view class="breakdown-value">{{ stats.byGroup.group2 }}</view>
          <view class="breakdown-percent">{{ stats.totalDraws > 0 ? (stats.byGroup.group2 / stats.totalDraws * 100).toFixed(0) : 0 }}%</view>
        </view>
      </view>
    </view>

    <!-- Orange generals -->
    <view v-if="stats.orangeGenerals.length > 0" class="section generals-card">
      <view class="generals-title">橙卡武将</view>
      <view class="generals-list">
        <view v-for="(g, idx) in stats.orangeGenerals" :key="idx" class="general-item">
          <view class="general-rank">{{ idx + 1 }}</view>
          <view class="general-name">{{ g.name }}</view>
          <view class="general-count">{{ g.count }} 次</view>
        </view>
      </view>
    </view>

    <!-- Monthly trend -->
    <view v-if="stats.byMonth.length > 0" class="section trend-card">
      <view class="trend-title">月度趋势</view>
      <view class="trend-chart">
        <view v-for="(m, idx) in stats.byMonth" :key="idx" class="trend-bar-group">
          <view class="trend-bars">
            <view class="trend-bar total" :style="{ height: getBarHeight(m.total, maxMonthly) + 'rpx' }"></view>
            <view class="trend-bar orange" :style="{ height: getBarHeight(m.orange, maxMonthlyOrange) + 'rpx' }"></view>
          </view>
          <view class="trend-label">{{ m.month.substring(5) }}</view>
          <view class="trend-count">{{ m.orange > 0 ? m.orange + '橙' : '' }}</view>
        </view>
      </view>
      <view class="trend-legend">
        <view class="legend-item">
          <view class="legend-dot total"></view>
          <text>总抽卡</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot orange"></view>
          <text>橙卡</text>
        </view>
      </view>
    </view>

    <!-- Empty state -->
    <view v-if="stats.totalDraws === 0" class="section empty-state">
      <view class="empty-icon">📊</view>
      <view class="empty-text">暂无抽卡记录</view>
      <view class="empty-hint">返回抽卡页面记录你的抽卡数据</view>
    </view>
  </view>
</template>

<script>
import * as drawStorage from "../../utils/drawStorage";

export default {
  data() {
    return {
      viewMode: "current",
      stats: {
        totalDraws: 0,
        orangeCount: 0,
        purpleCount: 0,
        blueCount: 0,
        orangeRate: 0,
        freeDraws: 0,
        halfDraws: 0,
        byMonth: [],
        byGroup: { group1: 0, group2: 0 },
        orangeGenerals: []
      }
    };
  },

  computed: {
    maxMonthly() {
      if (this.stats.byMonth.length === 0) return 1;
      return Math.max(...this.stats.byMonth.map(m => m.total), 1);
    },
    maxMonthlyOrange() {
      if (this.stats.byMonth.length === 0) return 1;
      return Math.max(...this.stats.byMonth.map(m => m.orange), 1);
    }
  },

  onLoad() {
    this.refreshStats();
  },

  methods: {
    goBack() {
      uni.navigateBack();
    },

    refreshStats() {
      const pools = drawStorage.getPools();
      if (pools.length === 0) {
        this.stats = {
          totalDraws: 0,
          orangeCount: 0,
          purpleCount: 0,
          blueCount: 0,
          orangeRate: 0,
          freeDraws: 0,
          halfDraws: 0,
          byMonth: [],
          byGroup: { group1: 0, group2: 0 },
          orangeGenerals: []
        };
        return;
      }

      const poolId = pools[0].id;

      if (this.viewMode === "current") {
        const seasonId = drawStorage.getCurrentSeason();
        if (seasonId) {
          this.stats = drawStorage.getSeasonStats(poolId, seasonId);
        } else {
          this.stats = drawStorage.getAllTimeStats(poolId);
        }
      } else {
        this.stats = drawStorage.getAllTimeStats(poolId);
      }
    },

    getBarHeight(value, max) {
      if (max === 0) return 0;
      return Math.max(4, Math.round((value / max) * 120));
    }
  }
};
</script>

<style scoped>
.stats-page {
  min-height: 100vh;
  padding: 24rpx;
  padding-bottom: 100rpx;
}

.header {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.back-btn {
  color: #f1d29a;
  font-size: 28rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f7e4bc;
}

/* Season tabs */
.season-tabs {
  display: flex;
  gap: 12rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8rpx;
  padding: 6rpx;
}

.season-tab {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6rpx;
  color: #8d97a5;
  font-size: 26rpx;
}

.season-tab.active {
  color: #1a1208;
  background: linear-gradient(180deg, #f1c879 0%, #c88732 100%);
  font-weight: 600;
}

/* Overview grid */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}

.overview-card {
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  text-align: center;
}

.card-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #f4ead8;
}

.card-label {
  font-size: 22rpx;
  color: #8d97a5;
  margin-top: 8rpx;
}

.overview-card.orange .card-value {
  color: #f1a64e;
}

.overview-card.purple .card-value {
  color: #b98cf0;
}

.overview-card.blue .card-value {
  color: #6ea8dc;
}

/* Rate card */
.rate-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  padding: 24rpx;
}

.rate-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rate-title {
  color: #f7e4bc;
  font-size: 28rpx;
  font-weight: 700;
}

.rate-value {
  color: #f1a64e;
  font-size: 40rpx;
  font-weight: 700;
}

.rate-bar {
  height: 16rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8rpx;
  margin-top: 16rpx;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  background: linear-gradient(90deg, #c88732 0%, #f1a64e 100%);
  border-radius: 8rpx;
  transition: width 0.3s;
}

.rate-desc {
  color: #8d97a5;
  font-size: 22rpx;
  margin-top: 12rpx;
}

/* Breakdown */
.breakdown-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  padding: 24rpx;
}

.breakdown-title {
  color: #f7e4bc;
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 16rpx;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.breakdown-label {
  color: #8d97a5;
  font-size: 24rpx;
  width: 100rpx;
}

.breakdown-value {
  color: #f4ead8;
  font-size: 28rpx;
  font-weight: 600;
  flex: 1;
}

.breakdown-percent {
  color: #8d97a5;
  font-size: 22rpx;
}

/* Generals */
.generals-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  padding: 24rpx;
}

.generals-title {
  color: #f7e4bc;
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 16rpx;
}

.generals-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.general-item {
  display: flex;
  align-items: center;
  padding: 12rpx 16rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8rpx;
}

.general-rank {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(214, 168, 93, 0.2);
  color: #f1d29a;
  font-size: 22rpx;
  font-weight: 600;
  margin-right: 16rpx;
}

.general-name {
  flex: 1;
  color: #f4ead8;
  font-size: 28rpx;
}

.general-count {
  color: #f1a64e;
  font-size: 24rpx;
  font-weight: 600;
}

/* Trend */
.trend-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 12rpx;
  padding: 24rpx;
}

.trend-title {
  color: #f7e4bc;
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 20rpx;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 8rpx;
  height: 180rpx;
  padding-bottom: 40rpx;
  position: relative;
}

.trend-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  height: 100%;
}

.trend-bars {
  display: flex;
  gap: 4rpx;
  align-items: flex-end;
  flex: 1;
}

.trend-bar {
  width: 20rpx;
  border-radius: 4rpx 4rpx 0 0;
  min-height: 4rpx;
}

.trend-bar.total {
  background: rgba(110, 168, 220, 0.6);
}

.trend-bar.orange {
  background: #f1a64e;
}

.trend-label {
  position: absolute;
  bottom: 0;
  color: #8d97a5;
  font-size: 18rpx;
}

.trend-count {
  position: absolute;
  bottom: -30rpx;
  color: #f1a64e;
  font-size: 16rpx;
  white-space: nowrap;
}

.trend-legend {
  display: flex;
  justify-content: center;
  gap: 24rpx;
  margin-top: 40rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #8d97a5;
  font-size: 22rpx;
}

.legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 4rpx;
}

.legend-dot.total {
  background: rgba(110, 168, 220, 0.6);
}

.legend-dot.orange {
  background: #f1a64e;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  color: #f7e4bc;
  font-size: 32rpx;
  font-weight: 600;
}

.empty-hint {
  color: #8d97a5;
  font-size: 24rpx;
  margin-top: 12rpx;
}
</style>
