<template>
  <view class="page stats-page">
    <view class="section stats-season-card">
      <view>
        <view class="season-label">当前赛季</view>
        <view class="season-name">{{ activeSeason ? activeSeason.name : '未设置' }}</view>
      </view>
      <view class="season-pity">
        <text>保底</text>
        <text>{{ pity.current }}/{{ pity.total }}</text>
      </view>
    </view>

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

    <!-- 出橙概率 -->
    <view class="section rate-card">
      <view class="rate-header">
        <view class="rate-title">出橙概率</view>
        <view class="rate-value">{{ stats.orangeRate }}%</view>
      </view>
      <view class="rate-bar">
        <view class="rate-fill" :style="{ width: stats.orangeRate + '%' }"></view>
      </view>
      <view v-if="stats.orangeCount > 0" class="rate-desc">
        平均每 {{ stats.orangeCount > 0 ? Math.round(stats.totalDraws / stats.orangeCount) : '-' }} 抽出一张橙卡
      </view>
    </view>

    <!-- 抽卡类型 -->
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

    <!-- 橙卡武将 -->
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

    <!-- 月度趋势 -->
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

    <!-- 空状态 -->
    <view v-if="stats.totalDraws === 0" class="section empty-state">
      <view class="empty-icon">统</view>
      <view class="empty-text">记录为空</view>
    </view>
  </view>
</template>

<script>
import * as drawStorage from "../../utils/drawStorage";

export default {
  data() {
    return {
      activeSeason: null,
      pity: { total: 30, current: 0, remaining: 30, guaranteedAt: null },
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
    refreshStats() {
      let pools = drawStorage.getPools();
      if (pools.length === 0) {
        drawStorage.ensureDefaultPool();
        pools = drawStorage.getPools();
      }

      if (pools.length === 0) {
        this.activeSeason = null;
        this.pity = { total: 30, current: 0, remaining: 30, guaranteedAt: null };
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
      const activeSeason = drawStorage.ensureDefaultSeason();
      this.activeSeason = activeSeason;
      this.pity = drawStorage.getPityInfo(poolId, activeSeason && activeSeason.id);
      this.stats = activeSeason
        ? drawStorage.getSeasonStats(poolId, activeSeason.id)
        : drawStorage.getAllTimeStats(poolId);
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

.stats-season-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-radius: 10rpx;
  border: 1rpx solid rgba(241, 210, 154, 0.36);
  background:
    linear-gradient(180deg, rgba(241, 210, 154, 0.12), rgba(15, 23, 35, 0.62)),
    rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 1rpx 0 rgba(255, 242, 185, 0.16), 0 12rpx 28rpx rgba(0, 0, 0, 0.22);
}

.season-label {
  color: #8d97a5;
  font-size: 22rpx;
}

.season-name {
  margin-top: 4rpx;
  color: #f7e4bc;
  font-size: 34rpx;
  font-weight: 800;
}

.season-pity {
  min-width: 120rpx;
  padding: 10rpx 14rpx;
  border-radius: 8rpx;
  border: 1rpx solid rgba(241, 166, 78, 0.36);
  background: rgba(241, 166, 78, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}

.season-pity text:first-child {
  color: #8d97a5;
  font-size: 18rpx;
}

.season-pity text:last-child {
  color: #f1a64e;
  font-size: 28rpx;
  font-weight: 800;
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

/* 出橙概率 */
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

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80rpx 40rpx;
}

.empty-icon {
  width: 88rpx;
  height: 88rpx;
  margin: 0 auto 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  border: 1rpx solid rgba(241, 210, 154, 0.42);
  color: #f7e4bc;
  background: linear-gradient(180deg, rgba(241, 210, 154, 0.18), rgba(15, 23, 35, 0.72));
  font-size: 42rpx;
  font-weight: 800;
}

.empty-text {
  color: #f7e4bc;
  font-size: 32rpx;
  font-weight: 600;
}

</style>
