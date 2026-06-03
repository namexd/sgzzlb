<template>
  <view class="page draw-page">
    <!-- Header + Pity bar inline -->
    <view class="hero">
      <view class="title">抽卡日历</view>
      <view class="hero-right">
        <view class="season-badge" @tap="showSeasonModal = true">
          {{ activeSeason ? activeSeason.name : '设置赛季' }}
        </view>
        <view class="stats-btn" @tap="goToStats">统计</view>
      </view>
    </view>

    <!-- Pity bar — 置顶一行 -->
    <view class="pity-row">
      <view class="pity-text">
        <text class="pity-label">保底</text>
        <text class="pity-count">{{ pity.current }}/{{ pity.total }}</text>
        <text v-if="pity.guaranteedAt" class="pity-hint">· 预计第{{ pity.guaranteedAt + 1 }}抽</text>
      </view>
      <view class="pity-bar">
        <view class="pity-fill" :style="{ width: (pity.current / pity.total * 100) + '%' }"></view>
      </view>
    </view>

    <!-- Calendar — 紧凑版 -->
    <view class="calendar-section">
      <view class="month-nav">
        <view class="month-arrow" @tap="prevMonth">◀</view>
        <view class="month-title" @tap="goToToday">{{ calMonth }}月</view>
        <view class="month-arrow" @tap="nextMonth">▶</view>
        <view class="month-summary">
          <text class="summary-text">{{ calTotalDraws }}抽</text>
          <text v-if="calOrangeCount > 0" class="summary-orange">橙{{ calOrangeCount }}</text>
          <text v-if="calPurpleCount > 0" class="summary-purple">紫{{ calPurpleCount }}</text>
        </view>
      </view>

      <view class="weekday-row">
        <view class="weekday" v-for="d in ['日','一','二','三','四','五','六']" :key="d">{{ d }}</view>
      </view>

      <view class="calendar-grid">
        <view v-for="(cell, idx) in calDays" :key="idx"
          :class="['cal-cell', { blank: cell.blank, today: cell.isToday, selected: cell.date === selectedDate }]"
          @tap="onDateTap(cell)">
          <template v-if="!cell.blank">
            <view class="cal-day-num">{{ cell.day }}</view>
            <view v-if="cell.hasOrange" class="cal-orange-dot"></view>
            <view v-else-if="cell.count > 0" class="cal-blue-dot"></view>
          </template>
        </view>
      </view>
    </view>

    <!-- Quick record + Records 合并 -->
    <view class="content-row">
      <!-- Quick buttons -->
      <view class="quick-col">
        <view class="col-title">快速记录</view>
        <view class="quick-btn free" @tap="quickRecord(1, 'free')">免费·1</view>
        <view class="quick-btn half" @tap="quickRecord(1, 'half')">半价·1</view>
        <view class="quick-btn free" @tap="quickRecord(2, 'free')">免费·2</view>
        <view class="quick-btn half" @tap="quickRecord(2, 'half')">半价·2</view>
      </view>

      <!-- Records -->
      <view class="records-col">
        <view class="records-header">
          <view class="col-title">{{ selectedDateText }}</view>
          <view class="add-btn" @tap="showAddRecord">+</view>
        </view>

        <view v-if="selectedRecords.length === 0" class="empty-hint">暂无记录</view>

        <view v-for="item in selectedRecords" :key="item.id" class="record-item">
          <view :class="['q-dot', item.quality]"></view>
          <view class="record-info">
            <text class="record-name">{{ item.generalName || '—' }}</text>
            <text class="record-meta">{{ qualityMap[item.quality] }} · {{ drawTypeMap[item.drawType] }} · 组{{ item.group }}</text>
          </view>
          <view class="record-del" @tap="onDeleteRecord(item.id)">✕</view>
        </view>
      </view>
    </view>

    <view class="feedback-link" @tap="goToFeedback">反馈 →</view>

    <!-- Add record modal -->
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

    <!-- Season modal -->
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

    <!-- End season confirm -->
    <view v-if="showEndSeasonConfirm" class="modal-mask" @tap="showEndSeasonConfirm = false">
      <view class="modal-panel" @tap.stop>
        <view class="modal-title">确认结束赛季</view>
        <view class="modal-desc">结束后将无法再往「{{ activeSeason.name }}」添加记录，确定要结束吗？</view>
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
        uni.showToast({ title: "请先选择日期", icon: "none" });
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
  color: var(--gold-bright);
}

.hero-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.season-badge {
  padding: 4rpx 14rpx;
  border: 1px solid var(--border-accent);
  border-radius: var(--r-sm);
  color: var(--gold);
  font-size: 20rpx;
  background: var(--gold-ghost);
}

.stats-btn {
  padding: 4rpx 14rpx;
  border-radius: var(--r-sm);
  color: var(--ink-deepest);
  background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold-dim) 100%);
  font-size: 20rpx;
  font-weight: 600;
}

/* Pity bar — 一行紧凑 */
.pity-row {
  background: var(--ink-surface);
  border: 1px solid var(--border-faint);
  border-radius: var(--r-sm);
  padding: 10rpx 16rpx;
  margin-bottom: 12rpx;
}

.pity-text {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 6rpx;
}

.pity-label {
  color: var(--text-stone);
  font-size: 20rpx;
}

.pity-count {
  color: var(--gold);
  font-size: 22rpx;
  font-weight: 700;
}

.pity-hint {
  color: var(--text-fade);
  font-size: 18rpx;
}

.pity-bar {
  height: 6rpx;
  background: var(--border-faint);
  border-radius: 3rpx;
  overflow: hidden;
}

.pity-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold-dim), var(--gold-bright));
  border-radius: 3rpx;
  transition: width 0.3s;
}

/* Calendar — 紧凑 */
.calendar-section {
  background: var(--ink-surface);
  border: 1px solid var(--border-faint);
  border-radius: var(--r-sm);
  padding: 12rpx 14rpx;
  margin-bottom: 12rpx;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.month-arrow {
  color: var(--gold);
  font-size: 22rpx;
  padding: 4rpx 8rpx;
}

.month-title {
  color: var(--gold-bright);
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
}

.summary-purple {
  color: #b98cf0;
  font-size: 18rpx;
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
  background: var(--gold-ghost);
  border-radius: 8rpx;
}

.cal-cell.selected {
  background: var(--gold-ghost);
  border: 1px solid var(--gold);
  border-radius: 8rpx;
}

.cal-day-num {
  color: var(--text-ink);
  font-size: 22rpx;
  font-weight: 600;
}

.cal-cell.today .cal-day-num {
  color: var(--gold);
}

.cal-orange-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--gold-bright);
  margin-top: 2rpx;
}

.cal-blue-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(110, 168, 220, 0.5);
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
  background: var(--ink-surface);
  border: 1px solid var(--border-faint);
  border-radius: var(--r-sm);
  padding: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
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
  border-radius: 6rpx;
  text-align: center;
  font-size: 20rpx;
  font-weight: 600;
}

.quick-btn.free {
  color: var(--ink-deepest);
  background: linear-gradient(135deg, var(--gold-bright), var(--gold-dim));
}

.quick-btn.half {
  color: var(--gold);
  background: var(--gold-ghost);
  border: 1px solid var(--border-accent);
}

.records-col {
  flex: 1;
  min-width: 0;
  background: var(--ink-surface);
  border: 1px solid var(--border-faint);
  border-radius: var(--r-sm);
  padding: 12rpx;
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
  background: var(--gold);
  color: var(--ink-deepest);
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
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
  border-bottom: 1px solid var(--border-faint);
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

.q-dot.orange { background: var(--gold-bright); }
.q-dot.purple { background: #b98cf0; }
.q-dot.blue { background: #6ea8dc; }

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
  background: rgba(4, 6, 10, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-panel {
  width: 560rpx;
  max-height: 80vh;
  padding: 28rpx;
  border: 1px solid var(--border-accent);
  border-radius: var(--r-md);
  background: var(--ink-mid);
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  color: var(--gold-bright);
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
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
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  color: var(--text-stone);
  font-size: 24rpx;
  font-weight: 600;
  background: var(--ink-surface);
}

.quality-opt.active {
  border-color: var(--gold);
  background: var(--gold-ghost);
  color: var(--gold);
}

.quality-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
}

.quality-dot.orange { background: var(--gold-bright); }
.quality-dot.purple { background: #b98cf0; }
.quality-dot.blue { background: #6ea8dc; }

/* Form */
.form-input {
  width: 100%;
  height: 64rpx;
  padding: 0 16rpx;
  margin-top: 16rpx;
  border: 1px solid var(--border-accent);
  border-radius: var(--r-sm);
  color: var(--text-ink);
  background: var(--ink-deep);
  font-size: 24rpx;
  box-sizing: border-box;
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
  border-radius: var(--r-sm);
  font-size: 24rpx;
  font-weight: 600;
}

.form-btn.cancel {
  color: var(--text-stone);
  background: var(--ink-surface);
  border: 1px solid var(--border-subtle);
}

.form-btn.confirm {
  color: var(--ink-deepest);
  background: linear-gradient(135deg, var(--gold-bright), var(--gold-dim));
}

.form-btn.danger {
  color: #fff;
  background: linear-gradient(135deg, var(--loss), #8a3530);
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
  border: 1px solid var(--border-faint);
  border-radius: var(--r-sm);
  margin-bottom: 8rpx;
}

.season-item.active {
  border-color: var(--gold);
  background: var(--gold-ghost);
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
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  color: var(--gold);
  background: var(--gold-ghost);
  border: 1px solid var(--border-accent);
  font-size: 18rpx;
}

.season-end {
  margin-top: 16rpx;
  padding: 12rpx;
  text-align: center;
  color: var(--loss);
  font-size: 22rpx;
  border: 1px solid rgba(196, 90, 74, 0.3);
  border-radius: var(--r-sm);
}
</style>
