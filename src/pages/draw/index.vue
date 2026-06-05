<template>
  <view class="page draw-page">
    <view class="draw-bg"></view>

    <view class="draw-topbar">
      <view class="nav-circle" @tap="goToFeedback">
        <image src="/static/ui-assets/mockup-icons/nav-back-circle.png" mode="aspectFit" />
      </view>
      <view class="brand-block">
        <view class="brand-title">三国·策略</view>
        <view class="brand-subtitle">
          <image src="/static/ui-assets/mockup-icons/title-ornament-left.png" mode="aspectFit" />
          <text>招贤纳士 · 共谋天下</text>
          <image src="/static/ui-assets/mockup-icons/title-ornament-right.png" mode="aspectFit" />
        </view>
      </view>
      <view class="top-actions">
        <view class="top-action" @tap="showSeasonModal = true">
          <image class="top-action-icon" src="/static/ui-assets/mockup-icons/draw-card-detail.png" mode="aspectFit" />
          <text>卡池详情</text>
        </view>
        <view class="top-action" @tap="goToStats">
          <image class="top-action-icon" src="/static/ui-assets/mockup-icons/draw-gift.png" mode="aspectFit" />
          <text>奖励预览</text>
        </view>
      </view>
    </view>

    <view class="pity-panel">
      <view class="panel-corners"></view>
      <view class="pity-head">
        <text class="pity-title">橙卡保底进度</text>
        <text class="pity-count">{{ pity.current }}/{{ pity.total }}</text>
      </view>
      <view class="pity-track">
        <view class="pity-fill" :style="{ width: pityPercent + '%' }"></view>
      </view>
      <view class="pity-tip">再招募 <text>{{ pity.remaining }}</text> 次，必得 <text>橙卡武将</text></view>
    </view>

    <view class="calendar-panel">
      <view class="month-nav">
        <view class="month-arrow left" @tap="prevMonth">
          <image src="/static/ui-assets/mockup-icons/title-ornament-left.png" mode="aspectFit" />
        </view>
        <view class="month-title" @tap="goToToday">{{ calYear }}年{{ calMonth }}月</view>
        <view class="month-arrow right" @tap="nextMonth">
          <image src="/static/ui-assets/mockup-icons/title-ornament-right.png" mode="aspectFit" />
        </view>
      </view>

      <view class="weekday-row">
        <view class="weekday" v-for="d in ['日','一','二','三','四','五','六']" :key="d">{{ d }}</view>
      </view>

      <view class="calendar-grid">
        <view
          v-for="(cell, idx) in calDays"
          :key="idx"
          :class="['cal-cell', { blank: cell.blank, today: cell.isToday, selected: cell.date === selectedDate }]"
          @tap="onDateTap(cell)"
        >
          <template v-if="!cell.blank">
            <view class="cal-day-num">{{ cell.day }}</view>
            <view v-if="cell.hasOrange" class="draw-token orange">橙</view>
            <view v-else-if="cell.count > 0" class="draw-token purple">紫</view>
          </template>
        </view>
      </view>

      <view class="legend-row">
        <view class="legend-item"><text class="draw-token orange">橙</text>橙卡</view>
        <view class="legend-item"><text class="draw-token purple">紫</text>紫卡</view>
        <view class="legend-item"><text class="draw-token dim">灰</text>未抽卡</view>
      </view>
    </view>

    <view class="quick-title">
      <image src="/static/ui-assets/mockup-icons/title-ornament-left.png" mode="aspectFit" />
      <text>快速记录</text>
      <image src="/static/ui-assets/mockup-icons/title-ornament-right.png" mode="aspectFit" />
    </view>
    <view class="quick-grid">
      <view class="quick-btn free" @tap="quickRecord(1, 'free')">
        <view class="quick-main"><image class="quick-icon" src="/static/ui-assets/mockup-icons/draw-quick-free.png" mode="aspectFit" />免费 · 1</view>
        <view class="quick-sub">第1组</view>
      </view>
      <view class="quick-btn half" @tap="quickRecord(1, 'half')">
        <view class="quick-main"><image class="quick-icon" src="/static/ui-assets/mockup-icons/draw-quick-half.png" mode="aspectFit" />半价 · 1</view>
        <view class="quick-sub">第1组</view>
      </view>
      <view class="quick-btn free" @tap="quickRecord(2, 'free')">
        <view class="quick-main"><image class="quick-icon" src="/static/ui-assets/mockup-icons/draw-quick-free.png" mode="aspectFit" />免费 · 2</view>
        <view class="quick-sub">第2组</view>
      </view>
      <view class="quick-btn half" @tap="quickRecord(2, 'half')">
        <view class="quick-main"><image class="quick-icon" src="/static/ui-assets/mockup-icons/draw-quick-half.png" mode="aspectFit" />半价 · 2</view>
        <view class="quick-sub">第2组</view>
      </view>
    </view>

    <view class="bottom-console">
      <view class="side-link" @tap="goToStats">
        <image class="side-icon-img" src="/static/ui-assets/mockup-icons/draw-side-stats.png" mode="aspectFit" />
        <view>抽卡统计</view>
      </view>
      <view class="recruit-btn" @tap="showAddRecord">添加记录</view>
      <view class="side-link" @tap="showAddRecord">
        <image class="side-icon-img" src="/static/ui-assets/mockup-icons/draw-side-record.png" mode="aspectFit" />
        <view>历史记录</view>
      </view>
    </view>

    <view class="record-panel">
      <view class="records-header">
        <view class="record-title">{{ selectedDateText }} 记录</view>
        <view class="add-btn" @tap="showAddRecord">新增</view>
      </view>
      <view v-for="item in selectedRecords" :key="item.id" class="record-item">
        <view :class="['q-dot', item.quality]"></view>
        <view class="record-info">
          <text class="record-name">{{ item.generalName || '武将记录' }}</text>
          <text class="record-meta">{{ qualityMap[item.quality] }} · {{ drawTypeMap[item.drawType] }} · 组{{ item.group }}</text>
        </view>
        <view class="record-del" @tap="onDeleteRecord(item.id)">删除</view>
      </view>
    </view>

    <view v-if="recordForm" class="modal-mask" @tap="recordForm = null">
      <view class="modal-panel" @tap.stop>
        <view class="modal-title">记录抽卡</view>
        <view class="modal-subtitle">{{ recordForm.date }} · 组{{ recordForm.group }} · {{ drawTypeMap[recordForm.drawType] }}</view>

        <view class="quality-picker">
          <view :class="['quality-opt', { active: recordForm.quality === 'orange' }]"
            @tap="recordForm.quality = 'orange'">
            <view class="quality-dot orange"></view>
            <text>橙</text>
          </view>
          <view :class="['quality-opt', { active: recordForm.quality === 'purple' }]"
            @tap="recordForm.quality = 'purple'">
            <view class="quality-dot purple"></view>
            <text>紫</text>
          </view>
          <view :class="['quality-opt', { active: recordForm.quality === 'blue' }]"
            @tap="recordForm.quality = 'blue'">
            <view class="quality-dot blue"></view>
            <text>蓝</text>
          </view>
        </view>

        <input class="form-input" v-model="recordForm.generalName" placeholder="武将名称（选填）" />

        <view class="form-actions">
          <view class="form-btn cancel" @tap="recordForm = null">取消</view>
          <view class="form-btn confirm" @tap="doAddRecord">确认</view>
        </view>
      </view>
    </view>

    <view v-if="showSeasonModal" class="modal-mask" @tap="showSeasonModal = false">
      <view class="modal-panel" @tap.stop>
        <view class="modal-title">赛季管理</view>

        <view v-if="seasons.length > 0" class="season-list">
          <view v-for="s in seasons" :key="s.id"
            :class="['season-item', { active: activeSeason && activeSeason.id === s.id }]">
            <view class="season-info">
              <view class="season-name">{{ s.name }}</view>
              <view class="season-dates">{{ s.startDate }} {{ s.endDate ? '— ' + s.endDate : '— 进行中' }}</view>
            </view>
            <view v-if="!s.endDate && (!activeSeason || activeSeason.id !== s.id)"
              class="season-action" @tap="switchSeason(s.id)">切换</view>
          </view>
        </view>

        <view class="form-input-group">
          <input class="form-input" v-model="newSeasonName" placeholder="新赛季名称（如 S2）" />
          <view class="form-btn confirm" @tap="doCreateSeason">创建</view>
        </view>

        <view v-if="activeSeason" class="season-end" @tap="confirmEndSeason">
          结束当前赛季「{{ activeSeason.name }}」
        </view>
      </view>
    </view>

    <view v-if="showEndSeasonConfirm" class="modal-mask" @tap="showEndSeasonConfirm = false">
      <view class="modal-panel" @tap.stop>
        <view class="modal-title">确认结束赛季</view>
        <view class="modal-desc">结束「{{ activeSeason.name }}」后停止新增记录</view>
        <view class="form-actions">
          <view class="form-btn cancel" @tap="showEndSeasonConfirm = false">取消</view>
          <view class="form-btn danger" @tap="doEndSeason">确认结束</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import * as drawStorage from "../../utils/drawStorage";

export default {
  data() {
    const now = new Date();
    return {
      calYear: now.getFullYear(),
      calMonth: now.getMonth() + 1,
      calDays: [],
      calTotalDraws: 0,
      calOrangeCount: 0,
      calPurpleCount: 0,
      selectedDate: this.formatDate(now),
      selectedRecords: [],
      pools: [],
      activePool: null,
      pity: { total: 30, current: 0, remaining: 30, guaranteedAt: null },
      qualityMap: drawStorage.QUALITY_MAP,
      drawTypeMap: drawStorage.DRAW_TYPE_MAP,
      recordForm: null,
      seasons: [],
      activeSeason: null,
      showSeasonModal: false,
      showEndSeasonConfirm: false,
      newSeasonName: ""
    };
  },

  computed: {
    pityPercent() {
      if (!this.pity || !this.pity.total) return 0;
      return Math.max(0, Math.min(100, Math.round((this.pity.current / this.pity.total) * 100)));
    },

    selectedDateText() {
      if (!this.selectedDate) return "选择日期";
      const parts = this.selectedDate.split("-");
      return `${parts[1]}月${parts[2]}日`;
    }
  },

  onShow() {
    this.refreshAll();
  },

  methods: {
    formatDate(d) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    },

    refreshAll() {
      // Ensure pool exists
      let pools = drawStorage.getPools();
      if (pools.length === 0) {
        drawStorage.ensureDefaultPool();
        pools = drawStorage.getPools();
      }
      const activePool = pools[0];

      // Ensure season exists
      const activeSeason = drawStorage.ensureDefaultSeason();
      const seasons = drawStorage.getSeasons();

      // Get pity info
      const pity = drawStorage.getPityInfo(activePool.id);

      // Build calendar
      const calData = drawStorage.buildCalendarDays(activePool.id, this.calYear, this.calMonth);

      // Mark today
      const todayStr = drawStorage.todayStr();
      const daysWithToday = calData.days.map(cell => ({
        ...cell,
        isToday: cell.date === todayStr
      }));

      // Get selected date records
      const selectedRecords = this.getSelectedDateRecords(activePool.id);

      Object.assign(this, {
        pools,
        activePool,
        activeSeason,
        seasons,
        pity,
        calDays: daysWithToday,
        calTotalDraws: calData.totalDraws,
        calOrangeCount: calData.orangeCount,
        calPurpleCount: calData.purpleCount,
        selectedRecords
      });
    },

    getSelectedDateRecords(poolId) {
      if (!this.selectedDate) return [];
      const records = drawStorage.getRecords(poolId);
      return records.filter(r => r.date === this.selectedDate);
    },

    prevMonth() {
      let { calYear: y, calMonth: m } = this;
      m--;
      if (m < 1) { y--; m = 12; }
      this.calYear = y;
      this.calMonth = m;
      this.refreshCalendar();
    },

    nextMonth() {
      let { calYear: y, calMonth: m } = this;
      m++;
      if (m > 12) { y++; m = 1; }
      this.calYear = y;
      this.calMonth = m;
      this.refreshCalendar();
    },

    goToToday() {
      const now = new Date();
      this.calYear = now.getFullYear();
      this.calMonth = now.getMonth() + 1;
      this.selectedDate = this.formatDate(now);
      this.refreshCalendar();
    },

    refreshCalendar() {
      if (!this.activePool) return;
      const calData = drawStorage.buildCalendarDays(this.activePool.id, this.calYear, this.calMonth);
      const todayStr = drawStorage.todayStr();
      const daysWithToday = calData.days.map(cell => ({
        ...cell,
        isToday: cell.date === todayStr
      }));
      this.calDays = daysWithToday;
      this.calTotalDraws = calData.totalDraws;
      this.calOrangeCount = calData.orangeCount;
      this.calPurpleCount = calData.purpleCount;
      this.selectedRecords = this.getSelectedDateRecords(this.activePool.id);
    },

    onDateTap(cell) {
      if (!cell.date) return;
      this.selectedDate = cell.date;
      this.selectedRecords = this.getSelectedDateRecords(this.activePool.id);
    },

    showAddRecord() {
      if (!this.selectedDate) {
        uni.showToast({ title: "选择日期", icon: "none" });
        return;
      }
      this.recordForm = {
        date: this.selectedDate,
        group: 1,
        drawType: "free",
        quality: "blue",
        generalName: ""
      };
    },

    quickRecord(group, drawType) {
      this.recordForm = {
        date: drawStorage.todayStr(),
        group,
        drawType,
        quality: "blue",
        generalName: ""
      };
    },

    doAddRecord() {
      if (!this.recordForm || !this.activePool) return;
      drawStorage.addRecord(this.activePool.id, {
        date: this.recordForm.date,
        quality: this.recordForm.quality,
        generalName: this.recordForm.generalName,
        drawType: this.recordForm.drawType,
        group: this.recordForm.group
      });
      this.recordForm = null;
      this.refreshAll();
      uni.showToast({ title: "已记录", icon: "success" });
    },

    onDeleteRecord(id) {
      if (!this.activePool) return;
      drawStorage.deleteRecord(this.activePool.id, id);
      this.refreshAll();
    },

    goToStats() {
      uni.navigateTo({ url: "/pages/draw/stats" });
    },

    goToFeedback() {
      uni.navigateTo({ url: "/pages/feedback/index" });
    },

    switchSeason(seasonId) {
      drawStorage.setCurrentSeason(seasonId);
      this.showSeasonModal = false;
      this.refreshAll();
    },

    doCreateSeason() {
      const name = (this.newSeasonName || "").trim();
      if (!name) {
        uni.showToast({ title: "请输入赛季名称", icon: "none" });
        return;
      }
      drawStorage.createSeason(name);
      this.newSeasonName = "";
      this.showSeasonModal = false;
      this.refreshAll();
      uni.showToast({ title: "赛季已创建", icon: "success" });
    },

    confirmEndSeason() {
      this.showSeasonModal = false;
      this.showEndSeasonConfirm = true;
    },

    doEndSeason() {
      drawStorage.endCurrentSeason();
      this.showEndSeasonConfirm = false;
      this.refreshAll();
      uni.showToast({ title: "赛季已结束", icon: "success" });
    }
  }
};
</script>

<style scoped>
.draw-page {
  min-height: 100vh;
  padding: 16rpx 20rpx;
  background: linear-gradient(135deg, #1a0a0a 0%, #2d1a0a 50%, #1a1a2e 100%);
  position: relative;
}

.draw-page::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% 30%, rgba(201, 152, 58, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
}

/* Header */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.hero-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.season-badge {
  padding: 6rpx 16rpx;
  border: 1px solid rgba(201, 152, 58, 0.4);
  border-radius: var(--r-sm);
  color: var(--gold-bright);
  font-size: 20rpx;
  background: rgba(201, 152, 58, 0.15);
  backdrop-filter: blur(5px);
}

.stats-btn {
  padding: 6rpx 16rpx;
  border-radius: var(--r-sm);
  color: #ffffff;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  font-size: 20rpx;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

/* Pity bar — 一行紧凑 */
.pity-row {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-md);
  padding: 12rpx 16rpx;
  margin-bottom: 12rpx;
  backdrop-filter: blur(10px);
}

.pity-text {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.pity-label {
  color: var(--text-stone);
  font-size: 20rpx;
}

.pity-count {
  color: var(--gold-bright);
  font-size: 22rpx;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(201, 152, 58, 0.3);
}

.pity-hint {
  color: var(--text-fade);
  font-size: 18rpx;
}

.pity-bar {
  height: 8rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4rpx;
  overflow: hidden;
}

.pity-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  border-radius: 4rpx;
  transition: width 0.3s;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
}

/* Calendar — 紧凑 */
.calendar-section {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-md);
  padding: 12rpx 14rpx;
  margin-bottom: 12rpx;
  backdrop-filter: blur(10px);
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.month-arrow {
  color: var(--gold-bright);
  font-size: 22rpx;
  padding: 4rpx 8rpx;
}

.month-title {
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 700;
}

.month-summary {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.summary-text {
  color: var(--text-stone);
  font-size: 18rpx;
}

.summary-orange {
  color: var(--gold-bright);
  font-size: 18rpx;
  font-weight: 600;
}

.summary-purple {
  color: #a78bfa;
  font-size: 18rpx;
  font-weight: 600;
}

.weekday-row {
  display: flex;
}

.weekday {
  flex: 1;
  text-align: center;
  padding: 4rpx 0;
  color: var(--text-fade);
  font-size: 18rpx;
}

.calendar-grid {
  display: flex;
  flex-wrap: wrap;
}

.cal-cell {
  width: calc(100% / 7);
  min-height: 60rpx;
  padding: 4rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.cal-cell.blank {
  opacity: 0;
}

.cal-cell.today {
  background: rgba(201, 152, 58, 0.15);
  border-radius: 8rpx;
}

.cal-cell.selected {
  background: rgba(201, 152, 58, 0.2);
  border: 1px solid rgba(201, 152, 58, 0.5);
  border-radius: 8rpx;
}

.cal-day-num {
  color: var(--text-ink);
  font-size: 22rpx;
  font-weight: 600;
}

.cal-cell.today .cal-day-num {
  color: var(--gold-bright);
}

.cal-orange-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--gold-bright);
  margin-top: 2rpx;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
}

.cal-blue-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.6);
  margin-top: 2rpx;
}

/* Content row — 快速记录 + 当日记录左右分栏 */
.content-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.quick-col {
  flex: 0 0 160rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-md);
  padding: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  backdrop-filter: blur(10px);
}

.col-title {
  color: var(--text-stone);
  font-size: 18rpx;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 2rpx;
}

.quick-btn {
  padding: 10rpx 0;
  border-radius: 8rpx;
  text-align: center;
  font-size: 20rpx;
  font-weight: 600;
}

.quick-btn.free {
  color: #ffffff;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.quick-btn.free:active {
  transform: scale(0.98);
}

.quick-btn.half {
  color: var(--gold-bright);
  background: rgba(201, 152, 58, 0.15);
  border: 1px solid rgba(201, 152, 58, 0.3);
}

.quick-btn.half:active {
  background: rgba(201, 152, 58, 0.25);
}

.records-col {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-md);
  padding: 12rpx;
  backdrop-filter: blur(10px);
}

.records-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.add-btn {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.empty-hint {
  text-align: center;
  color: var(--text-fade);
  font-size: 20rpx;
  padding: 24rpx 0;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.record-item:last-child {
  border-bottom: none;
}

.q-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.q-dot.orange {
  background: var(--gold-bright);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.q-dot.purple {
  background: #a78bfa;
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
}

.q-dot.blue {
  background: #60a5fa;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.6);
}

.record-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.record-name {
  color: var(--text-ink);
  font-size: 20rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta {
  color: var(--text-fade);
  font-size: 16rpx;
}

.record-del {
  color: var(--loss);
  font-size: 20rpx;
  padding: 4rpx;
  flex-shrink: 0;
}

/* Feedback */
.feedback-link {
  text-align: center;
  color: var(--text-fade);
  font-size: 20rpx;
  padding: 8rpx 0;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(4, 6, 10, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.modal-panel {
  width: 560rpx;
  max-height: 80vh;
  padding: 28rpx;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--r-lg);
  background: rgba(30, 30, 50, 0.95);
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
}

.modal-title {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.modal-subtitle {
  color: var(--text-stone);
  font-size: 20rpx;
  text-align: center;
  margin-top: 6rpx;
}

.modal-desc {
  color: var(--text-ink);
  font-size: 24rpx;
  margin-top: 16rpx;
  line-height: 1.6;
}

/* Quality picker */
.quality-picker {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
}

.quality-opt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  height: 64rpx;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--r-md);
  color: var(--text-stone);
  font-size: 24rpx;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
}

.quality-opt.active {
  border-color: rgba(201, 152, 58, 0.5);
  background: rgba(201, 152, 58, 0.15);
  color: var(--gold-bright);
}

.quality-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}

.quality-dot.orange {
  background: var(--gold-bright);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.quality-dot.purple {
  background: #a78bfa;
  box-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
}

.quality-dot.blue {
  background: #60a5fa;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.6);
}

/* Form */
.form-input {
  width: 100%;
  height: 64rpx;
  padding: 0 16rpx;
  margin-top: 16rpx;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--r-md);
  color: var(--text-ink);
  background: rgba(255, 255, 255, 0.08);
  font-size: 24rpx;
  box-sizing: border-box;
  backdrop-filter: blur(5px);
}

.form-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.form-input-group {
  display: flex;
  gap: 8rpx;
  margin-top: 16rpx;
}

.form-input-group .form-input {
  flex: 1;
  margin-top: 0;
}

.form-input-group .form-btn {
  width: 100rpx;
}

.form-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
}

.form-btn {
  flex: 1;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-md);
  font-size: 24rpx;
  font-weight: 600;
}

.form-btn.cancel {
  color: var(--text-stone);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.form-btn.confirm {
  color: #ffffff;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.form-btn.confirm:active {
  transform: scale(0.98);
}

.form-btn.danger {
  color: #fff;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

/* Season */
.season-list {
  margin-top: 16rpx;
  max-height: 300rpx;
  overflow-y: auto;
}

.season-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r-md);
  margin-bottom: 8rpx;
  background: rgba(255, 255, 255, 0.04);
}

.season-item.active {
  border-color: rgba(201, 152, 58, 0.4);
  background: rgba(201, 152, 58, 0.1);
}

.season-info {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.season-name {
  color: var(--gold-bright);
  font-size: 24rpx;
  font-weight: 600;
}

.season-dates {
  color: var(--text-stone);
  font-size: 18rpx;
}

.season-action {
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  color: var(--gold-bright);
  background: rgba(201, 152, 58, 0.15);
  border: 1px solid rgba(201, 152, 58, 0.3);
  font-size: 18rpx;
}

.season-end {
  margin-top: 16rpx;
  padding: 12rpx;
  text-align: center;
  color: var(--loss);
  font-size: 22rpx;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--r-md);
  background: rgba(239, 68, 68, 0.1);
}

.draw-page {
  min-height: 100vh;
  padding: 72rpx 28rpx 150rpx;
  background:
    linear-gradient(180deg, rgba(34, 22, 12, 0.9) 0%, rgba(15, 12, 9, 0.98) 42%, #090908 100%),
    linear-gradient(120deg, #2d1709 0%, #0b1014 48%, #2b1608 100%);
  position: relative;
  overflow: hidden;
}

.draw-page::before {
  display: none;
}

.draw-bg {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    linear-gradient(110deg, rgba(255, 170, 47, 0.08), transparent 34%, rgba(94, 50, 20, 0.18)),
    linear-gradient(180deg, rgba(255, 218, 134, 0.08), transparent 32%, rgba(255, 113, 24, 0.08));
  pointer-events: none;
  z-index: 0;
}

.draw-topbar,
.pity-panel,
.calendar-panel,
.quick-title,
.quick-grid,
.bottom-console,
.record-panel {
  position: relative;
  z-index: 1;
}

.draw-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 34rpx;
}

.nav-circle {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(231, 194, 112, 0.36);
  color: #f2d58d;
  font-size: 58rpx;
  line-height: 1;
  background: rgba(14, 11, 8, 0.58);
}

.brand-block {
  flex: 1;
  text-align: center;
}

.brand-title {
  color: #f6d381;
  font-size: 58rpx;
  font-weight: 900;
  line-height: 1.05;
  text-shadow: 0 7rpx 18rpx rgba(0, 0, 0, 0.65), 0 0 24rpx rgba(245, 183, 67, 0.28);
}

.brand-subtitle {
  margin-top: 6rpx;
  color: rgba(245, 218, 164, 0.78);
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.brand-subtitle image {
  width: 66rpx;
  height: 18rpx;
  display: block;
  opacity: 0.6;
  mix-blend-mode: screen;
}

.brand-subtitle text {
  flex-shrink: 0;
}

.top-actions {
  display: flex;
  gap: 10rpx;
}

.top-action {
  min-width: 88rpx;
  padding: 10rpx 12rpx;
  border: 1rpx solid rgba(225, 187, 104, 0.32);
  border-radius: 999rpx;
  color: #f0d18d;
  background: rgba(28, 20, 11, 0.72);
  font-size: 20rpx;
  text-align: center;
}

.pity-panel,
.calendar-panel,
.record-panel {
  border: 1rpx solid rgba(218, 174, 82, 0.42);
  background: linear-gradient(180deg, rgba(28, 24, 18, 0.88), rgba(12, 12, 10, 0.9));
  box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.38), inset 0 0 0 1rpx rgba(255, 233, 176, 0.06);
}

.pity-panel {
  margin-bottom: 28rpx;
  padding: 30rpx 34rpx;
  border-radius: 8rpx;
}

.pity-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18rpx;
}

.pity-title {
  color: #f2d58d;
  font-size: 30rpx;
  font-weight: 800;
}

.pity-count {
  color: #f8e7b3;
  font-size: 34rpx;
  font-weight: 900;
}

.pity-track {
  height: 24rpx;
  border: 1rpx solid rgba(242, 202, 111, 0.44);
  border-radius: 999rpx;
  padding: 3rpx;
  background: rgba(4, 4, 3, 0.8);
  overflow: hidden;
}

.pity-fill {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #f28a1b 0%, #ffcf61 72%, #fff0a8 100%);
  box-shadow: 0 0 18rpx rgba(255, 190, 61, 0.48);
  transition: width 0.24s ease;
}

.pity-tip {
  margin-top: 18rpx;
  text-align: center;
  color: #d8c59e;
  font-size: 26rpx;
}

.pity-tip text {
  color: #f1a72c;
  font-weight: 800;
}

.calendar-panel {
  padding: 22rpx 18rpx 24rpx;
  border-radius: 10rpx;
  margin-bottom: 24rpx;
}

.month-nav {
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 42rpx;
  border-bottom: 1rpx solid rgba(218, 174, 82, 0.18);
  margin: 0 4rpx 14rpx;
}

.month-arrow {
  color: #a8844c;
  font-size: 48rpx;
  line-height: 1;
  padding: 0 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-arrow image {
  width: 58rpx;
  height: 22rpx;
  display: block;
  opacity: 0.78;
  mix-blend-mode: screen;
}

.month-title {
  color: #ead6b0;
  font-size: 38rpx;
  font-weight: 800;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8rpx;
}

.weekday {
  text-align: center;
  color: #d7b979;
  font-size: 26rpx;
  font-weight: 700;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-top: 1rpx solid rgba(193, 151, 78, 0.28);
  border-left: 1rpx solid rgba(193, 151, 78, 0.28);
}

.cal-cell {
  width: auto;
  min-height: 92rpx;
  padding: 8rpx 4rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8rpx;
  border-right: 1rpx solid rgba(193, 151, 78, 0.28);
  border-bottom: 1rpx solid rgba(193, 151, 78, 0.28);
  background: rgba(11, 11, 9, 0.42);
}

.cal-cell.blank {
  opacity: 0.38;
}

.cal-cell.today,
.cal-cell.selected {
  background: rgba(166, 108, 24, 0.24);
  box-shadow: inset 0 0 0 1rpx rgba(245, 193, 83, 0.38);
}

.cal-day-num {
  color: #dcd3c3;
  font-size: 30rpx;
  font-weight: 800;
}

.cal-cell:nth-child(7n + 1) .cal-day-num,
.cal-cell:nth-child(7n) .cal-day-num {
  color: #ff8b25;
}

.draw-token {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 900;
  color: #fff3d3;
  border: 1rpx solid rgba(255, 238, 177, 0.55);
}

.draw-token.orange {
  background: linear-gradient(145deg, #ff8a17, #a84b08);
  box-shadow: 0 0 18rpx rgba(255, 129, 21, 0.52);
}

.draw-token.purple {
  background: linear-gradient(145deg, #9c68ff, #4a267b);
  box-shadow: 0 0 18rpx rgba(159, 105, 255, 0.46);
}

.draw-token.dim {
  color: #8b7653;
  background: rgba(72, 58, 36, 0.5);
  border-color: rgba(120, 99, 62, 0.42);
  box-shadow: none;
}

.legend-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
  padding-top: 24rpx;
  color: #d6bd83;
  font-size: 24rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.quick-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
  color: #f3d58d;
  font-size: 32rpx;
  font-weight: 800;
}

.quick-title image {
  width: 128rpx;
  height: 28rpx;
  display: block;
  opacity: 0.86;
  mix-blend-mode: screen;
}

.quick-title text {
  flex-shrink: 0;
  text-shadow: 0 0 14rpx rgba(214, 168, 93, 0.28), 0 5rpx 12rpx rgba(0, 0, 0, 0.5);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.quick-btn {
  min-height: 96rpx;
  border-radius: 10rpx;
  border: 1rpx solid rgba(255, 198, 65, 0.62);
  background: linear-gradient(180deg, rgba(147, 96, 19, 0.9), rgba(67, 42, 8, 0.95));
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.34), inset 0 0 20rpx rgba(255, 198, 65, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.quick-btn:active,
.recruit-btn:active,
.side-link:active {
  transform: scale(0.98);
}

.quick-main {
  color: #fff0be;
  font-size: 26rpx;
  font-weight: 900;
}

.quick-sub {
  color: #f0d59a;
  font-size: 24rpx;
}

.bottom-console {
  display: grid;
  grid-template-columns: 1fr 2.1fr 1fr;
  align-items: center;
  gap: 16rpx;
  margin-top: -8rpx;
  margin-bottom: 48rpx;
}

.side-link {
  color: #dfc385;
  font-size: 22rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.side-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(221, 180, 90, 0.36);
  background: rgba(42, 34, 19, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0d38c;
  font-size: 24rpx;
}

.recruit-btn {
  height: 86rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff2c2;
  font-size: 40rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #c89737 0%, #8a5816 100%);
  border: 1rpx solid rgba(255, 231, 158, 0.62);
  box-shadow: 0 0 28rpx rgba(242, 177, 45, 0.36), inset 0 0 18rpx rgba(255, 239, 179, 0.28);
}

.record-panel {
  padding: 24rpx;
  border-radius: 10rpx;
}

.record-title {
  color: #f0d38c;
  font-size: 28rpx;
  font-weight: 800;
}

.add-btn {
  min-width: 88rpx;
  width: auto;
  height: 46rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: rgba(222, 172, 67, 0.18);
  color: #f4d58b;
  border: 1rpx solid rgba(222, 172, 67, 0.38);
  font-size: 22rpx;
}

.empty-hint {
  color: #7f7565;
  font-size: 24rpx;
  text-align: center;
  padding: 28rpx 0;
}

.record-item {
  gap: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid rgba(222, 172, 67, 0.12);
  border-bottom: 0;
}

.record-name {
  color: #eadcc0;
  font-size: 26rpx;
  font-weight: 800;
}

.record-meta {
  color: #91836d;
  font-size: 22rpx;
}

.record-del {
  color: #d1684d;
  font-size: 22rpx;
}

.modal-panel {
  max-height: 82vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #1d1a14, #0d0d0c);
  border-radius: 16rpx;
  border: 1rpx solid rgba(218, 174, 82, 0.5);
}

.modal-title {
  color: #f4d58b;
  font-weight: 900;
}

.modal-subtitle,
.modal-desc {
  color: #a99b83;
}

.quality-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.quality-opt {
  min-height: 112rpx;
  border-radius: 12rpx;
  border: 1rpx solid rgba(218, 174, 82, 0.18);
  background: rgba(255, 255, 255, 0.04);
  justify-content: center;
}

.quality-opt.active {
  border-color: rgba(244, 213, 139, 0.72);
  background: rgba(183, 126, 28, 0.2);
  color: #f4d58b;
}

.form-input {
  border-radius: 10rpx;
  border: 1rpx solid rgba(218, 174, 82, 0.22);
  background: rgba(8, 8, 7, 0.72);
  color: #eadcc0;
}

.form-btn.cancel {
  background: rgba(255, 255, 255, 0.06);
  color: #a99b83;
}

.form-btn.confirm {
  background: linear-gradient(180deg, #d09934, #8d5a16);
  color: #fff2c2;
}

.form-btn.danger {
  background: linear-gradient(180deg, #d7674b, #912f28);
  color: #fff2c2;
}

.season-name {
  color: #eadcc0;
  font-weight: 800;
}

.season-item.active .season-name,
.season-action {
  color: #f4d58b;
}

.season-end {
  color: #d1684d;
  border-color: rgba(209, 104, 77, 0.32);
  background: rgba(209, 104, 77, 0.08);
}

.draw-page {
  background:
    radial-gradient(circle at 50% -6%, rgba(255, 178, 55, 0.26), transparent 32%),
    radial-gradient(circle at 92% 28%, rgba(255, 111, 24, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(34, 22, 12, 0.9) 0%, rgba(15, 12, 9, 0.98) 42%, #090908 100%),
    linear-gradient(120deg, #2d1709 0%, #0b1014 48%, #2b1608 100%);
}

.brand-title {
  color: transparent;
  background: linear-gradient(180deg, #fff2ba 0%, #e7b455 46%, #8e551a 64%, #ffe9a6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 22rpx rgba(255, 188, 64, 0.28), 0 8rpx 20rpx rgba(0, 0, 0, 0.62);
}

.nav-circle,
.top-action,
.pity-panel,
.calendar-panel,
.record-panel {
  box-shadow:
    0 18rpx 42rpx rgba(0, 0, 0, 0.45),
    inset 0 1rpx 0 rgba(255, 242, 185, 0.16),
    inset 0 -28rpx 46rpx rgba(0, 0, 0, 0.34);
}

.pity-panel,
.calendar-panel,
.record-panel {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    linear-gradient(#17120b, #0c0b09) padding-box,
    linear-gradient(145deg, rgba(255, 230, 150, 0.86), rgba(98, 62, 24, 0.34) 38%, rgba(255, 155, 36, 0.72) 100%) border-box;
  border: 2rpx solid transparent;
}

.pity-panel::before,
.calendar-panel::before,
.record-panel::before {
  content: "";
  position: absolute;
  inset: 8rpx;
  pointer-events: none;
  z-index: 2;
  background:
    linear-gradient(90deg, #f7d887 0 28rpx, transparent 28rpx) left top / 82rpx 2rpx no-repeat,
    linear-gradient(#f7d887 0 28rpx, transparent 28rpx) left top / 2rpx 82rpx no-repeat,
    linear-gradient(270deg, #f7d887 0 28rpx, transparent 28rpx) right top / 82rpx 2rpx no-repeat,
    linear-gradient(#f7d887 0 28rpx, transparent 28rpx) right top / 2rpx 82rpx no-repeat,
    linear-gradient(90deg, #f7d887 0 28rpx, transparent 28rpx) left bottom / 82rpx 2rpx no-repeat,
    linear-gradient(0deg, #f7d887 0 28rpx, transparent 28rpx) left bottom / 2rpx 82rpx no-repeat,
    linear-gradient(270deg, #f7d887 0 28rpx, transparent 28rpx) right bottom / 82rpx 2rpx no-repeat,
    linear-gradient(0deg, #f7d887 0 28rpx, transparent 28rpx) right bottom / 2rpx 82rpx no-repeat;
  opacity: 0.46;
}

.pity-panel::after,
.calendar-panel::after,
.record-panel::after {
  content: "";
  position: absolute;
  left: -20%;
  right: -20%;
  top: 0;
  height: 64rpx;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 237, 178, 0.12), transparent);
}

.pity-track {
  box-shadow: inset 0 0 14rpx rgba(0, 0, 0, 0.86), 0 0 10rpx rgba(255, 199, 65, 0.18);
}

.pity-fill {
  background: linear-gradient(180deg, #fff0a5 0%, #ffbd3c 42%, #f47a18 100%);
  box-shadow: 0 0 24rpx rgba(255, 190, 61, 0.68), inset 0 3rpx 6rpx rgba(255, 255, 255, 0.42);
}

.cal-cell {
  box-shadow: inset 0 0 16rpx rgba(0, 0, 0, 0.24);
}

.cal-cell.today,
.cal-cell.selected {
  border-color: rgba(255, 205, 84, 0.72);
  box-shadow: inset 0 0 0 2rpx rgba(255, 191, 62, 0.58), 0 0 18rpx rgba(255, 140, 23, 0.24);
}

.draw-token {
  box-shadow: 0 0 20rpx rgba(255, 202, 86, 0.28), inset 0 0 12rpx rgba(255, 255, 255, 0.18);
}

.quick-btn,
.recruit-btn,
.add-btn,
.form-btn.confirm {
  position: relative;
  overflow: hidden;
  border: 0;
  background:
    linear-gradient(180deg, rgba(255, 246, 194, 0.22) 0%, transparent 34%),
    linear-gradient(180deg, #e49e30 0%, #935614 54%, #4a2c10 100%);
  box-shadow:
    0 12rpx 26rpx rgba(0, 0, 0, 0.44),
    0 0 18rpx rgba(255, 171, 38, 0.3),
    inset 0 1rpx 0 rgba(255, 245, 190, 0.58),
    inset 0 -8rpx 16rpx rgba(61, 31, 6, 0.55);
}

.quick-btn::before,
.recruit-btn::before,
.form-btn.confirm::before {
  content: "";
  position: absolute;
  inset: 4rpx;
  border: 1rpx solid rgba(255, 230, 150, 0.34);
  border-radius: inherit;
  pointer-events: none;
}

.quick-btn::after,
.recruit-btn::after {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  top: 6rpx;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 245, 190, 0.78), transparent);
}

.recruit-btn {
  clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
  letter-spacing: 0;
  text-shadow: 0 3rpx 8rpx rgba(80, 40, 4, 0.72);
}

.side-icon {
  box-shadow: 0 0 18rpx rgba(214, 168, 93, 0.2), inset 0 0 12rpx rgba(255, 235, 170, 0.08);
}

.nav-circle image {
  width: 100%;
  height: 100%;
  display: block;
  mix-blend-mode: screen;
  filter: brightness(1.25) contrast(1.08);
}

.top-action {
  flex-direction: column;
  gap: 4rpx;
  min-width: 76rpx;
  height: auto;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.top-action-icon {
  width: 54rpx;
  height: 54rpx;
  display: block;
  mix-blend-mode: screen;
  filter: brightness(1.18) contrast(1.08);
}

.top-action text {
  color: #f0d8a4;
  font-size: 20rpx;
  line-height: 1.2;
  text-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.58);
}

.draw-token.orange,
.draw-token.purple {
  color: transparent;
  border: 0;
  box-shadow: none;
  background-color: transparent;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.draw-token.orange {
  background-image: url("/static/ui-assets/mockup-icons/draw-token-orange.png");
}

.draw-token.purple {
  background-image: url("/static/ui-assets/mockup-icons/draw-token-purple.png");
}

.quick-main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.quick-icon {
  width: 28rpx;
  height: 28rpx;
  display: block;
  mix-blend-mode: screen;
}

.side-icon-img {
  width: 50rpx;
  height: 50rpx;
  display: block;
  mix-blend-mode: screen;
  filter: brightness(1.2) contrast(1.08);
}
</style>
