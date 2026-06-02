<template>
  <view class="page draw-page">
    <!-- Header -->
    <view class="section hero">
      <view class="title">抽卡记录</view>
      <picker :range="poolNames" :value="poolIndex" @change="onPoolChange">
        <view class="pool-selector">{{ activePool.name || '主卡池' }} ▾</view>
      </picker>
    </view>

    <!-- Pity bar -->
    <view class="section band pity-bar">
      <view class="row-between">
        <view class="pity-label">保底进度</view>
        <view class="pity-value">{{ pity.current }}/{{ pity.total }}</view>
      </view>
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: (pity.current / pity.total * 100) + '%' }"></view>
      </view>
      <view v-if="pity.guaranteedAt" class="pity-hint">
        已抽 {{ pity.current }} 次无橙 · 预计保底第 {{ pity.guaranteedAt + 1 }} 次
      </view>
      <view v-else class="pity-hint ok">保底已重置，重新计数中</view>
    </view>

    <!-- Sub tabs -->
    <view class="sub-tabs">
      <view :class="['sub-tab', { active: subTab === 'today' }]" @tap="subTab = 'today'">今日</view>
      <view :class="['sub-tab', { active: subTab === 'calendar' }]" @tap="subTab = 'calendar'">日历</view>
      <view :class="['sub-tab', { active: subTab === 'pools' }]" @tap="subTab = 'pools'">卡池</view>
    </view>

    <!-- Today tab -->
    <view v-if="subTab === 'today'">
      <view v-if="drawWindow.activeGroup" class="section reminder-band">
        组 {{ drawWindow.activeGroup }} 抽卡窗口已开放 · 免费+半价可用
      </view>
      <view v-else class="section muted-band">当前不在抽卡窗口内</view>

      <!-- Group 1 -->
      <view class="section band">
        <view class="card-title">第一组 5:00 — 16:30</view>
        <view class="row" style="margin-top: 14rpx; gap: 16rpx;">
          <button class="draw-btn free" @tap="quickRecord(1, 'free')">免费·1</button>
          <button class="draw-btn half" @tap="quickRecord(1, 'half')">半价·1</button>
        </view>
        <view v-if="todayRecords.group1.length" class="today-log">
          <view v-for="item in todayRecords.group1" :key="item.id" class="log-item">
            <text :class="['quality-dot', item.quality]">●</text>
            {{ item.time }} · {{ qualityMap[item.quality] }} · {{ item.generalName || '未记录' }} · {{ drawTypeMap[item.drawType] }}
            <text class="log-del" @tap="onDeleteRecord(item.id)">✕</text>
          </view>
        </view>
      </view>

      <!-- Group 2 -->
      <view class="section band">
        <view class="card-title">第二组 16:30 — 次日 4:59</view>
        <view class="row" style="margin-top: 14rpx; gap: 16rpx;">
          <button class="draw-btn free" @tap="quickRecord(2, 'free')">免费·2</button>
          <button class="draw-btn half" @tap="quickRecord(2, 'half')">半价·2</button>
        </view>
        <view v-if="todayRecords.group2.length" class="today-log">
          <view v-for="item in todayRecords.group2" :key="item.id" class="log-item">
            <text :class="['quality-dot', item.quality]">●</text>
            {{ item.time }} · {{ qualityMap[item.quality] }} · {{ item.generalName || '未记录' }} · {{ drawTypeMap[item.drawType] }}
            <text class="log-del" @tap="onDeleteRecord(item.id)">✕</text>
          </view>
        </view>
      </view>

      <!-- Today summary -->
      <view v-if="todayTotalDraws > 0" class="section band">
        <view class="card-title">今日统计</view>
        <view class="note">共 {{ todayTotalDraws }} 抽：橙 {{ todayOrangeCount }} · 紫 {{ todayPurpleCount }} · 蓝 {{ todayBlueCount }}</view>
      </view>
    </view>

    <!-- Calendar tab -->
    <view v-if="subTab === 'calendar'">
      <view class="section month-nav">
        <view class="month-arrow" @tap="prevMonth">◀</view>
        <view class="month-title">{{ calYear }}年{{ calMonth }}月</view>
        <view class="month-arrow" @tap="nextMonth">▶</view>
      </view>

      <view class="weekday-row">
        <view class="weekday" v-for="d in ['日','一','二','三','四','五','六']" :key="d">{{ d }}</view>
      </view>

      <view class="calendar-grid">
        <view v-for="(cell, idx) in calDays" :key="idx"
          :class="['cal-cell', { blank: cell.blank, selected: cell.date === selectedDate }]"
          @tap="onDateTap(cell)">
          <template v-if="!cell.blank">
            <view class="cal-day-num">{{ cell.day }}</view>
            <view v-if="cell.hasOrange" class="cal-orange-dot">●</view>
            <view v-if="cell.count > 0" class="cal-count">{{ cell.count }}抽</view>
          </template>
        </view>
      </view>

      <view class="section band">
        <view class="card-title">{{ calYear }}年{{ calMonth }}月统计</view>
        <view class="note">共 {{ calTotalDraws }} 抽：橙 {{ calOrangeCount }} · 紫 {{ calPurpleCount }} · 蓝 {{ calBlueCount }}</view>
      </view>

      <!-- Date detail modal -->
      <view v-if="dateDetail" class="modal-mask" @tap="dateDetail = null">
        <view class="modal-panel" @tap.stop>
          <view class="card-title">{{ dateDetailDate }} 抽卡详情</view>
          <view v-for="item in dateDetail" :key="item.id" class="detail-item">
            <text :class="['quality-dot', item.quality]">●</text>
            {{ item.time }} · {{ qualityMap[item.quality] }} · {{ item.generalName || '未记录' }} · {{ drawTypeMap[item.drawType] }} · 组{{ item.group }}
          </view>
          <button class="btn secondary" @tap="dateDetail = null" style="margin-top: 24rpx;">关闭</button>
        </view>
      </view>
    </view>

    <!-- Pools tab -->
    <view v-if="subTab === 'pools'">
      <view v-for="pool in pools" :key="pool.id" class="section band pool-item">
        <view class="row-between">
          <view>
            <view class="card-title">{{ pool.name }}</view>
            <view class="muted">{{ pool.createdAtText }}</view>
          </view>
          <view class="row" style="gap: 12rpx;">
            <button v-if="pool.id !== activePool.id" class="mini-btn" @tap="switchPool(pool.id)">切换</button>
            <button class="mini-btn danger-btn" @tap="confirmDeletePool(pool)">删除</button>
          </view>
        </view>
        <view class="note">保底进度：{{ pool.pityProgress }}</view>
      </view>
      <view class="section">
        <button class="btn secondary" @tap="showAddPoolModal = true">+ 新增卡池</button>
      </view>
    </view>

    <!-- Add pool modal -->
    <view v-if="showAddPoolModal" class="modal-mask" @tap="showAddPoolModal = false">
      <view class="modal-panel" @tap.stop>
        <view class="card-title">新增卡池</view>
        <input class="config-input" v-model="newPoolName" placeholder="输入卡池名称" style="margin-top: 18rpx;" />
        <view class="row" style="margin-top: 24rpx; gap: 16rpx;">
          <button class="btn secondary" @tap="showAddPoolModal = false">取消</button>
          <button class="btn" @tap="doAddPool">确认</button>
        </view>
      </view>
    </view>

    <!-- Delete pool confirm -->
    <view v-if="deletePoolTarget" class="modal-mask" @tap="deletePoolTarget = null">
      <view class="modal-panel" @tap.stop>
        <view class="card-title">确认删除</view>
        <view class="note" style="margin-top: 16rpx;">删除卡池「{{ deletePoolTarget.name }}」及其所有记录，不可恢复。</view>
        <view class="row" style="margin-top: 24rpx; gap: 16rpx;">
          <button class="btn secondary" @tap="deletePoolTarget = null">取消</button>
          <button class="btn danger-fill" @tap="doDeletePool">确认删除</button>
        </view>
      </view>
    </view>

    <!-- Record form modal -->
    <view v-if="recordForm" class="modal-mask" @tap="recordForm = null">
      <view class="modal-panel" @tap.stop>
        <view class="card-title">记录抽卡 · 组{{ recordForm.group }} · {{ drawTypeMap[recordForm.drawType] }}</view>
        <view class="quality-picker" style="margin-top: 20rpx;">
          <view :class="['quality-option', { selected: recordForm.quality === 'orange', 'orange-bg': recordForm.quality === 'orange' }]"
            @tap="recordForm.quality = 'orange'">橙</view>
          <view :class="['quality-option', { selected: recordForm.quality === 'purple', 'purple-bg': recordForm.quality === 'purple' }]"
            @tap="recordForm.quality = 'purple'">紫</view>
          <view :class="['quality-option', { selected: recordForm.quality === 'blue', 'blue-bg': recordForm.quality === 'blue' }]"
            @tap="recordForm.quality = 'blue'">蓝</view>
        </view>
        <input class="config-input" v-model="recordForm.generalName" placeholder="武将名称（选填）" style="margin-top: 20rpx;" />
        <view class="row" style="margin-top: 24rpx; gap: 16rpx;">
          <button class="btn secondary" @tap="recordForm = null">取消</button>
          <button class="btn" @tap="doAddRecord">确认记录</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import * as drawStorage from "../../utils/drawStorage";
import * as api from "../../services/api";

export default {
  data() {
    return {
      subTab: "today",
      activePool: null,
      poolIndex: 0,
      poolNames: [],
      pools: [],
      pity: { total: 30, current: 0, remaining: 30, guaranteedAt: null },
      drawWindow: { activeGroup: null },
      todayDrawDate: "",
      todayRecords: { group1: [], group2: [] },
      todayTotalDraws: 0,
      todayOrangeCount: 0,
      todayPurpleCount: 0,
      todayBlueCount: 0,
      qualityMap: drawStorage.QUALITY_MAP,
      drawTypeMap: drawStorage.DRAW_TYPE_MAP,
      calYear: new Date().getFullYear(),
      calMonth: new Date().getMonth() + 1,
      calDays: [],
      calTotalDraws: 0,
      calOrangeCount: 0,
      calPurpleCount: 0,
      calBlueCount: 0,
      selectedDate: "",
      dateDetail: null,
      dateDetailDate: "",
      showAddPoolModal: false,
      newPoolName: "",
      deletePoolTarget: null,
      recordForm: null
    };
  },
  onShow() {
    this.refreshAll();
  },
  methods: {
    refreshAll() {
      let activePool = this.activePool;
      if (!activePool) {
        const pools = drawStorage.getPools();
        activePool = pools.length === 0 ? drawStorage.ensureDefaultPool() : pools[0];
      }
      const pools = drawStorage.getPools();
      const pity = drawStorage.getPityInfo(activePool.id);
      const drawWindow = drawStorage.getDrawWindow();
      const todayDrawDate = drawStorage.getDrawDate();
      const todayRecords = drawStorage.getTodayGroupRecords(activePool.id);
      const todayAll = [...todayRecords.group1, ...todayRecords.group2];
      const poolNames = pools.map(p => p.name);
      const poolIndex = pools.findIndex(p => p.id === activePool.id);
      const calData = drawStorage.buildCalendarDays(activePool.id, this.calYear, this.calMonth);
      const poolsWithPity = pools.map(p => {
        const info = drawStorage.getPityInfo(p.id);
        return {
          ...p,
          createdAtText: p.createdAt ? p.createdAt.slice(0, 10) : "",
          pityProgress: `${info.current}/${info.total}${info.guaranteedAt ? " · 预计保底第" + (info.guaranteedAt + 1) + "次" : " · 已重置"}`
        };
      });

      Object.assign(this, {
        activePool, poolIndex: poolIndex < 0 ? 0 : poolIndex, poolNames,
        pools: poolsWithPity, pity, drawWindow, todayDrawDate, todayRecords,
        todayTotalDraws: todayAll.length,
        todayOrangeCount: todayAll.filter(r => r.quality === "orange").length,
        todayPurpleCount: todayAll.filter(r => r.quality === "purple").length,
        todayBlueCount: todayAll.filter(r => r.quality === "blue").length,
        ...calData
      });
    },
    onPoolChange(e) {
      const pools = drawStorage.getPools();
      this.activePool = pools[e.detail.value];
      this.refreshAll();
    },
    switchPool(poolId) {
      const pools = drawStorage.getPools();
      this.activePool = pools.find(p => p.id === poolId);
      this.refreshAll();
    },
    quickRecord(group, drawType) {
      this.recordForm = { group, drawType, quality: "blue", generalName: "" };
    },
    doAddRecord() {
      if (!this.recordForm) return;
      drawStorage.addRecord(this.activePool.id, {
        quality: this.recordForm.quality,
        generalName: this.recordForm.generalName,
        drawType: this.recordForm.drawType,
        group: this.recordForm.group
      });
      this.recordForm = null;
      this.refreshAll();
    },
    onDeleteRecord(id) {
      drawStorage.deleteRecord(this.activePool.id, id);
      this.refreshAll();
    },
    doAddPool() {
      const name = (this.newPoolName || "").trim();
      if (!name) return;
      this.activePool = drawStorage.createPool(name);
      this.showAddPoolModal = false;
      this.newPoolName = "";
      this.refreshAll();
    },
    confirmDeletePool(pool) {
      this.deletePoolTarget = pool;
    },
    doDeletePool() {
      if (!this.deletePoolTarget) return;
      drawStorage.deletePool(this.deletePoolTarget.id);
      const pools = drawStorage.getPools();
      this.activePool = pools.length === 0 ? drawStorage.ensureDefaultPool() : pools[0];
      this.deletePoolTarget = null;
      this.refreshAll();
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
    refreshCalendar() {
      const calData = drawStorage.buildCalendarDays(this.activePool.id, this.calYear, this.calMonth);
      Object.assign(this, calData, { selectedDate: "", dateDetail: null });
    },
    onDateTap(cell) {
      if (!cell.date) return;
      this.selectedDate = cell.date;
      this.dateDetail = cell.records || [];
      this.dateDetailDate = cell.date;
    }
  }
};
</script>

<style scoped>
.draw-page { min-height: 100vh; padding: 24rpx; }
.hero { display: flex; align-items: center; justify-content: space-between; }
.pool-selector { padding: 10rpx 20rpx; border: 1rpx solid rgba(214, 168, 93, 0.34); border-radius: 6rpx; color: #f1d29a; font-size: 24rpx; background: rgba(214, 168, 93, 0.08); }
.pity-bar { margin-top: 16rpx; }
.pity-label { color: #b9c2cf; font-size: 24rpx; }
.pity-value { color: #f1d29a; font-size: 28rpx; font-weight: 700; }
.progress-track { height: 10rpx; margin-top: 14rpx; border-radius: 5rpx; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.progress-fill { height: 100%; border-radius: 5rpx; background: linear-gradient(90deg, #c88732 0%, #f1c879 100%); transition: width 0.3s; }
.pity-hint { margin-top: 10rpx; font-size: 22rpx; color: #8d97a5; }
.sub-tabs { display: flex; margin: 20rpx 0 16rpx; border-bottom: 2rpx solid rgba(255, 255, 255, 0.08); }
.sub-tab { flex: 1; padding: 18rpx 0; text-align: center; color: #8d97a5; font-size: 26rpx; border-bottom: 4rpx solid transparent; }
.sub-tab.active { color: #f1d29a; border-bottom-color: #d6a85d; }
.reminder-band { padding: 18rpx 24rpx; border-radius: 8rpx; color: #1a1208; background: linear-gradient(135deg, #f1c879 0%, #c88732 100%); font-size: 24rpx; font-weight: 600; text-align: center; }
.muted-band { padding: 18rpx 24rpx; border-radius: 8rpx; background: rgba(255, 255, 255, 0.04); color: #8d97a5; font-size: 24rpx; text-align: center; }
.draw-btn { flex: 1; height: 80rpx; border: 0; border-radius: 8rpx; font-size: 26rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0; }
.draw-btn.free { color: #1a1208; background: linear-gradient(180deg, #f1c879 0%, #c88732 100%); }
.draw-btn.half { color: #f1d29a; background: rgba(214, 168, 93, 0.1); border: 1rpx solid rgba(214, 168, 93, 0.34); }
.today-log { margin-top: 16rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.06); }
.log-item { padding: 14rpx 0; border-bottom: 1rpx solid rgba(255, 255, 255, 0.04); color: #b9c2cf; font-size: 24rpx; display: flex; align-items: center; gap: 6rpx; }
.log-del { margin-left: auto; color: #e68973; font-size: 24rpx; padding: 4rpx 8rpx; }
.quality-dot { font-size: 20rpx; }
.quality-dot.orange { color: #f1a64e; }
.quality-dot.purple { color: #b98cf0; }
.quality-dot.blue { color: #6ea8dc; }
.month-nav { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; }
.month-arrow { padding: 12rpx 20rpx; color: #f1d29a; font-size: 28rpx; }
.month-title { color: #f7e4bc; font-size: 32rpx; font-weight: 700; }
.weekday-row { display: flex; margin-bottom: 8rpx; }
.weekday { flex: 1; text-align: center; padding: 10rpx 0; color: #8d97a5; font-size: 22rpx; }
.calendar-grid { display: flex; flex-wrap: wrap; }
.cal-cell { width: calc(100% / 7); min-height: 110rpx; padding: 8rpx 4rpx; border: 1rpx solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
.cal-cell.blank { background: transparent; }
.cal-cell.selected { background: rgba(214, 168, 93, 0.12); border-color: rgba(214, 168, 93, 0.34); }
.cal-day-num { color: #b9c2cf; font-size: 24rpx; font-weight: 600; }
.cal-orange-dot { color: #f1a64e; font-size: 18rpx; margin-top: 2rpx; }
.cal-count { color: #8d97a5; font-size: 18rpx; margin-top: 2rpx; }
.pool-item { margin-bottom: 16rpx; }
.danger-btn { border-color: rgba(230, 137, 115, 0.4) !important; color: #e68973 !important; background: rgba(230, 137, 115, 0.08) !important; }
.danger-fill { color: #fff !important; background: linear-gradient(180deg, #e68973 0%, #c0392b 100%) !important; border: 0 !important; display: flex !important; align-items: center; justify-content: center; }
.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-panel { width: 600rpx; max-height: 80vh; padding: 36rpx; border: 1rpx solid rgba(214, 168, 93, 0.22); border-radius: 12rpx; background: #17202a; overflow-y: auto; }
.quality-picker { display: flex; gap: 16rpx; }
.quality-option { flex: 1; height: 72rpx; border: 1rpx solid rgba(255, 255, 255, 0.12); border-radius: 8rpx; display: flex; align-items: center; justify-content: center; color: #8d97a5; font-size: 26rpx; font-weight: 700; background: rgba(255, 255, 255, 0.04); }
.quality-option.selected { border-color: transparent; color: #fff; }
.quality-option.orange-bg { background: #c88732; }
.quality-option.purple-bg { background: #7d5fb8; }
.quality-option.blue-bg { background: #3a7bbf; }
.detail-item { padding: 12rpx 0; border-bottom: 1rpx solid rgba(255, 255, 255, 0.05); color: #b9c2cf; font-size: 24rpx; }
.card-title { color: #f7e4bc; font-size: 30rpx; font-weight: 700; }
.note { margin-top: 14rpx; color: #b9c2cf; font-size: 24rpx; line-height: 1.55; }
.config-input { box-sizing: border-box; width: 100%; height: 72rpx; padding: 0 18rpx; border: 1rpx solid rgba(214, 168, 93, 0.22); border-radius: 6rpx; color: #f4ead8; background: rgba(8, 12, 18, 0.45); font-size: 24rpx; }
.muted { color: #8d97a5; }
.ok { color: #9bd08f; }
.mini-btn { min-width: 90rpx; height: 50rpx; padding: 0 14rpx; border-radius: 6rpx; border: 1rpx solid rgba(214, 168, 93, 0.36); color: #f1d29a; background: rgba(214, 168, 93, 0.08); font-size: 22rpx; display: flex; align-items: center; justify-content: center; }
.btn { flex: 1; height: 76rpx; border: 0; border-radius: 8rpx; color: #1a1208; background: linear-gradient(180deg, #f1c879 0%, #c88732 100%); font-size: 28rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0; }
.btn.secondary { color: #f3d8a1; background: rgba(214, 168, 93, 0.1); border: 1rpx solid rgba(214, 168, 93, 0.34); }
</style>
