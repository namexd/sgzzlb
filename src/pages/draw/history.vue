<template>
  <view class="page history-page">
    <view class="history-bg"></view>

    <view class="history-head">
      <view>
        <view class="page-title">历史记录</view>
        <view class="page-subtitle">{{ activeSeason ? activeSeason.name : '当前赛季' }} · {{ records.length }} 条</view>
      </view>
      <view class="back-btn" @tap="goBack">返回</view>
    </view>

    <view class="filter-row">
      <view
        v-for="item in filterOptions"
        :key="item.key"
        :class="['filter-chip', { active: qualityFilter === item.key }]"
        @tap="qualityFilter = item.key"
      >
        <text>{{ item.label }}</text>
        <text>{{ item.count }}</text>
      </view>
    </view>

    <view v-if="groupedRecords.length === 0" class="empty-card">
      <view class="empty-title">暂无记录</view>
      <view class="empty-desc">抽卡记录会按日期汇总在这里</view>
    </view>

    <view v-for="group in groupedRecords" :key="group.date" class="history-group">
      <view class="group-title">
        <text>{{ formatDateTitle(group.date) }}</text>
        <text>{{ group.records.length }} 条</text>
      </view>
      <view v-for="item in group.records" :key="item.id" class="record-row">
        <view :class="['quality-badge', item.quality]">{{ qualityMap[item.quality] }}</view>
        <view class="record-main">
          <view class="record-name">{{ item.generalName || `${qualityMap[item.quality]}卡记录` }}</view>
          <view class="record-meta">
            {{ drawTypeMap[item.drawType] || '抽卡' }} · 组{{ item.group || 1 }}{{ item.time ? ' · ' + item.time : '' }}
          </view>
        </view>
        <view class="delete-btn" @tap="deleteRecord(item.id)">删除</view>
      </view>
    </view>
  </view>
</template>

<script>
import * as drawStorage from "../../utils/drawStorage";

export default {
  data() {
    return {
      activePool: null,
      activeSeason: null,
      records: [],
      qualityFilter: "all",
      qualityMap: drawStorage.QUALITY_MAP,
      drawTypeMap: drawStorage.DRAW_TYPE_MAP
    };
  },

  computed: {
    filteredRecords() {
      if (this.qualityFilter === "all") return this.records;
      return this.records.filter(item => item.quality === this.qualityFilter);
    },

    groupedRecords() {
      const groups = [];
      const byDate = new Map();
      this.filteredRecords.forEach(item => {
        const date = item.date || "未记录日期";
        if (!byDate.has(date)) {
          byDate.set(date, { date, records: [] });
          groups.push(byDate.get(date));
        }
        byDate.get(date).records.push(item);
      });
      return groups;
    },

    filterOptions() {
      const countByQuality = quality => this.records.filter(item => item.quality === quality).length;
      return [
        { key: "all", label: "全部", count: this.records.length },
        { key: "orange", label: "橙", count: countByQuality("orange") },
        { key: "purple", label: "紫", count: countByQuality("purple") },
        { key: "blue", label: "蓝", count: countByQuality("blue") }
      ];
    }
  },

  onLoad() {
    this.refreshRecords();
  },

  onShow() {
    this.refreshRecords();
  },

  methods: {
    refreshRecords() {
      let pools = drawStorage.getPools();
      if (pools.length === 0) {
        drawStorage.ensureDefaultPool();
        pools = drawStorage.getPools();
      }
      const activePool = pools[0] || null;
      const activeSeason = drawStorage.ensureDefaultSeason();
      const seasonId = activeSeason && activeSeason.id;
      const records = activePool
        ? (seasonId ? drawStorage.getSeasonRecords(activePool.id, seasonId) : drawStorage.getRecords(activePool.id))
        : [];

      this.activePool = activePool;
      this.activeSeason = activeSeason;
      this.records = records.slice().sort((a, b) => {
        const left = `${a.date || ""} ${a.time || ""}`;
        const right = `${b.date || ""} ${b.time || ""}`;
        return right.localeCompare(left);
      });
    },

    deleteRecord(id) {
      if (!this.activePool) return;
      drawStorage.deleteRecord(this.activePool.id, id);
      this.refreshRecords();
      uni.showToast({ title: "已删除", icon: "success" });
    },

    formatDateTitle(dateText) {
      if (!dateText || dateText === "未记录日期") return dateText;
      const parts = dateText.split("-");
      if (parts.length < 3) return dateText;
      return `${parts[1]}月${parts[2]}日`;
    },

    goBack() {
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      if (pages.length > 1) {
        uni.navigateBack();
        return;
      }
      uni.reLaunch({ url: "/pages/draw/index" });
    }
  }
};
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  padding: 44rpx 24rpx 120rpx;
  background:
    radial-gradient(circle at 50% -6%, rgba(255, 178, 55, 0.22), transparent 32%),
    linear-gradient(180deg, rgba(34, 22, 12, 0.96) 0%, rgba(12, 10, 8, 0.98) 42%, #080807 100%);
  position: relative;
  overflow: hidden;
}

.history-bg {
  position: fixed;
  inset: 0;
  background:
    linear-gradient(110deg, rgba(255, 170, 47, 0.08), transparent 34%, rgba(94, 50, 20, 0.18)),
    linear-gradient(180deg, rgba(255, 218, 134, 0.08), transparent 32%, rgba(255, 113, 24, 0.08));
  pointer-events: none;
}

.history-head,
.filter-row,
.history-group,
.empty-card {
  position: relative;
  z-index: 1;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.page-title {
  color: #f6d88f;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.2;
}

.page-subtitle {
  margin-top: 6rpx;
  color: #9e8b67;
  font-size: 22rpx;
}

.back-btn {
  height: 48rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(232, 184, 83, 0.38);
  background: rgba(218, 149, 39, 0.16);
  color: #f4d58b;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-bottom: 18rpx;
}

.filter-chip {
  min-height: 64rpx;
  border-radius: 10rpx;
  border: 1rpx solid rgba(218, 174, 82, 0.18);
  background: rgba(8, 8, 7, 0.58);
  color: #9d8a65;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  font-size: 20rpx;
  font-weight: 800;
}

.filter-chip.active {
  color: #fff1bd;
  border-color: rgba(255, 207, 97, 0.62);
  background: linear-gradient(180deg, rgba(164, 101, 23, 0.82), rgba(59, 33, 11, 0.92));
  box-shadow: 0 0 20rpx rgba(255, 166, 37, 0.18);
}

.history-group,
.empty-card {
  border-radius: 10rpx;
  border: 2rpx solid transparent;
  background:
    linear-gradient(#17120b, #0c0b09) padding-box,
    linear-gradient(145deg, rgba(255, 230, 150, 0.78), rgba(98, 62, 24, 0.28) 38%, rgba(255, 155, 36, 0.64) 100%) border-box;
  box-shadow:
    0 18rpx 42rpx rgba(0, 0, 0, 0.42),
    inset 0 1rpx 0 rgba(255, 242, 185, 0.14);
  margin-bottom: 16rpx;
  overflow: hidden;
}

.group-title {
  height: 68rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid rgba(218, 174, 82, 0.16);
  color: #f0d38c;
  font-size: 26rpx;
  font-weight: 900;
}

.group-title text:last-child {
  color: #9e8b67;
  font-size: 20rpx;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 18rpx;
  border-bottom: 1rpx solid rgba(218, 174, 82, 0.1);
}

.record-row:last-child {
  border-bottom: 0;
}

.quality-badge {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff2c2;
  font-size: 20rpx;
  font-weight: 900;
}

.quality-badge.orange {
  background: linear-gradient(180deg, #f7c65e, #d16b19);
  box-shadow: 0 0 18rpx rgba(245, 158, 11, 0.36);
}

.quality-badge.purple {
  background: linear-gradient(180deg, #b091ff, #6437aa);
  box-shadow: 0 0 18rpx rgba(167, 139, 250, 0.28);
}

.quality-badge.blue {
  background: linear-gradient(180deg, #75a6d4, #315b7c);
  box-shadow: 0 0 18rpx rgba(96, 165, 250, 0.24);
}

.record-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.record-name {
  color: #eadcc0;
  font-size: 26rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta {
  color: #91836d;
  font-size: 21rpx;
}

.delete-btn {
  flex-shrink: 0;
  color: #d1684d;
  font-size: 22rpx;
  padding: 8rpx;
}

.empty-card {
  padding: 64rpx 24rpx;
  text-align: center;
}

.empty-title {
  color: #f0d38c;
  font-size: 28rpx;
  font-weight: 900;
}

.empty-desc {
  margin-top: 8rpx;
  color: #817460;
  font-size: 22rpx;
}
</style>
