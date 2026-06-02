var drawStorage = require("../../utils/drawStorage");
var api = require("../../services/api");

Page({
  data: {
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
    syncStatus: "",

    // Calendar
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

    // Modals
    showAddPoolModal: false,
    newPoolName: "",
    deletePoolTarget: null,
    recordForm: null
  },

  onShow: function () {
    this.refreshAll();
  },

  isRemote: function () {
    return api.isRemoteMode();
  },

  refreshAll: function () {
    var self = this;
    if (self.isRemote()) {
      self.refreshFromRemote();
    } else {
      self.refreshFromLocal();
    }
  },

  refreshFromLocal: function () {
    var activePool = this.data.activePool;
    if (!activePool) {
      var pools = drawStorage.getPools();
      if (pools.length === 0) {
        activePool = drawStorage.ensureDefaultPool();
      } else {
        activePool = pools[0];
      }
    }
    var pools = drawStorage.getPools();
    this.updateView(activePool, pools, drawStorage.getRecords(activePool.id));
  },

  refreshFromRemote: function () {
    var self = this;
    self.setData({ syncStatus: "同步中..." });
    Promise.all([
      api.getDrawPoolsAsync(),
      api.getDrawRecordsAsync(self.data.activePool ? self.data.activePool.id : "")
    ]).then(function (results) {
      var pools = results[0];
      var records = results[1];
      if (pools.length === 0) {
        // Auto-create default pool on server
        return api.createDrawPoolAsync({ name: "主卡池" }).then(function (res) {
          pools = [res.item];
          self.updateView(res.item, pools, []);
          self.setData({ syncStatus: "已同步" });
        });
      }
      var activePool = self.data.activePool;
      if (!activePool || !pools.find(function (p) { return p.id === activePool.id; })) {
        activePool = pools[0];
      }
      // Fetch records for active pool
      api.getDrawRecordsAsync(activePool.id).then(function (poolRecords) {
        self.updateView(activePool, pools, poolRecords);
        self.setData({ syncStatus: "已同步" });
      });
    }).catch(function (err) {
      self.setData({ syncStatus: "同步失败: " + err.message });
      self.refreshFromLocal();
    });
  },

  updateView: function (activePool, pools, records) {
    var pity = drawStorage.getPityInfo(activePool.id);
    var drawWindow = drawStorage.getDrawWindow();
    var todayDrawDate = drawStorage.getDrawDate();

    // Filter today's records
    var drawDate = drawStorage.getDrawDate();
    var todayRecords = {
      group1: records.filter(function (r) { return r.date === drawDate && r.group === 1; }),
      group2: records.filter(function (r) { return r.date === drawDate && r.group === 2; })
    };

    var todayAll = todayRecords.group1.concat(todayRecords.group2);
    var todayOrange = todayAll.filter(function (r) { return r.quality === "orange"; }).length;
    var todayPurple = todayAll.filter(function (r) { return r.quality === "purple"; }).length;
    var todayBlue = todayAll.filter(function (r) { return r.quality === "blue"; }).length;

    var poolNames = pools.map(function (p) { return p.name; });
    var poolIndex = pools.findIndex(function (p) { return p.id === activePool.id; });
    if (poolIndex < 0) poolIndex = 0;

    // Calendar data
    var calData = drawStorage.buildCalendarDays(activePool.id, this.data.calYear, this.data.calMonth);

    // Pool pity previews
    var poolsWithPity = pools.map(function (p) {
      var info = drawStorage.getPityInfo(p.id);
      return {
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        createdAtText: p.createdAt ? p.createdAt.slice(0, 10) : "",
        pityProgress: info.current + "/" + info.total + (info.guaranteedAt ? " · 预计保底第" + (info.guaranteedAt + 1) + "次" : " · 已重置")
      };
    });

    this.setData({
      activePool: activePool,
      poolIndex: poolIndex,
      poolNames: poolNames,
      pools: poolsWithPity,
      pity: pity,
      drawWindow: drawWindow,
      todayDrawDate: todayDrawDate,
      todayRecords: todayRecords,
      todayTotalDraws: todayAll.length,
      todayOrangeCount: todayOrange,
      todayPurpleCount: todayPurple,
      todayBlueCount: todayBlue,
      calDays: calData.days,
      calTotalDraws: calData.totalDraws,
      calOrangeCount: calData.orangeCount,
      calPurpleCount: calData.purpleCount,
      calBlueCount: calData.blueCount
    });
  },

  // --- sub-tabs ---

  switchTab: function (e) {
    this.setData({ subTab: e.currentTarget.dataset.tab });
  },

  // --- pool ---

  onPoolChange: function (e) {
    var pools = drawStorage.getPools();
    var pool = pools[e.detail.value];
    if (pool) {
      this.setData({ activePool: pool });
      this.refreshAll();
    }
  },

  switchPool: function (e) {
    var pools = drawStorage.getPools();
    var pool = pools.find(function (p) { return p.id === e.currentTarget.dataset.id; });
    if (pool) {
      this.setData({ activePool: pool });
      this.refreshAll();
    }
  },

  showAddPool: function () {
    this.setData({ showAddPoolModal: true, newPoolName: "" });
  },

  closeAddPool: function () {
    this.setData({ showAddPoolModal: false });
  },

  onNewPoolNameInput: function (e) {
    this.setData({ newPoolName: e.detail.value });
  },

  doAddPool: function () {
    var self = this;
    var name = (self.data.newPoolName || "").trim();
    if (!name) return;

    if (self.isRemote()) {
      api.createDrawPoolAsync({ name: name }).then(function (res) {
        self.setData({ showAddPoolModal: false, activePool: res.item });
        self.refreshAll();
      });
    } else {
      var pool = drawStorage.createPool(name);
      self.setData({ showAddPoolModal: false, activePool: pool });
      self.refreshAll();
    }
  },

  confirmDeletePool: function (e) {
    var pools = drawStorage.getPools();
    var pool = pools.find(function (p) { return p.id === e.currentTarget.dataset.id; });
    if (pool) this.setData({ deletePoolTarget: pool });
  },

  closeDeletePool: function () {
    this.setData({ deletePoolTarget: null });
  },

  doDeletePool: function () {
    var self = this;
    var target = self.data.deletePoolTarget;
    if (!target) return;

    var afterDelete = function () {
      var pools = drawStorage.getPools();
      if (pools.length === 0) {
        drawStorage.ensureDefaultPool();
        pools = drawStorage.getPools();
      }
      self.setData({ deletePoolTarget: null, activePool: pools[0] });
      self.refreshAll();
    };

    if (self.isRemote()) {
      api.deleteDrawPoolAsync(target.id).then(afterDelete);
    } else {
      drawStorage.deletePool(target.id);
      afterDelete();
    }
  },

  // --- record ---

  quickRecord: function (e) {
    this.setData({
      recordForm: {
        group: Number(e.currentTarget.dataset.group),
        drawType: e.currentTarget.dataset.type,
        quality: "blue",
        generalName: ""
      }
    });
  },

  closeRecordForm: function () {
    this.setData({ recordForm: null });
  },

  setQuality: function (e) {
    var form = this.data.recordForm;
    form.quality = e.currentTarget.dataset.q;
    this.setData({ recordForm: form });
  },

  onGeneralNameInput: function (e) {
    var form = this.data.recordForm;
    form.generalName = e.detail.value;
    this.setData({ recordForm: form });
  },

  doAddRecord: function () {
    var self = this;
    var form = self.data.recordForm;
    if (!form) return;

    var recordData = {
      poolId: self.data.activePool.id,
      quality: form.quality,
      generalName: form.generalName,
      drawType: form.drawType,
      group: form.group
    };

    if (self.isRemote()) {
      api.addDrawRecordAsync(recordData).then(function () {
        self.setData({ recordForm: null });
        self.refreshAll();
      });
    } else {
      drawStorage.addRecord(recordData.poolId, recordData);
      self.setData({ recordForm: null });
      self.refreshAll();
    }
  },

  onDeleteRecord: function (e) {
    var self = this;
    if (self.isRemote()) {
      api.deleteDrawRecordAsync(self.data.activePool.id, e.currentTarget.dataset.id).then(function () {
        self.refreshAll();
      });
    } else {
      drawStorage.deleteRecord(self.data.activePool.id, e.currentTarget.dataset.id);
      self.refreshAll();
    }
  },

  // --- calendar ---

  prevMonth: function () {
    var y = this.data.calYear;
    var m = this.data.calMonth - 1;
    if (m < 1) { y--; m = 12; }
    this.setData({ calYear: y, calMonth: m });
    this.refreshCalendar();
  },

  nextMonth: function () {
    var y = this.data.calYear;
    var m = this.data.calMonth + 1;
    if (m > 12) { y++; m = 1; }
    this.setData({ calYear: y, calMonth: m });
    this.refreshCalendar();
  },

  refreshCalendar: function () {
    var calData = drawStorage.buildCalendarDays(this.data.activePool.id, this.data.calYear, this.data.calMonth);
    this.setData({
      calDays: calData.days,
      calTotalDraws: calData.totalDraws,
      calOrangeCount: calData.orangeCount,
      calPurpleCount: calData.purpleCount,
      calBlueCount: calData.blueCount,
      selectedDate: "",
      dateDetail: null
    });
  },

  onDateTap: function (e) {
    var date = e.currentTarget.dataset.date;
    var records = e.currentTarget.dataset.records;
    if (!date) return;
    this.setData({
      selectedDate: date,
      dateDetail: records && records.length ? records : [],
      dateDetailDate: date
    });
  },

  closeDateDetail: function () {
    this.setData({ dateDetail: null, selectedDate: "" });
  },

  noop: function () {}
});
