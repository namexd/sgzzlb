import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// drawStorage relies on wx.* globals which don't exist in Node.
// We mock them minimally before requiring.
global.wx = {
  _store: new Map(),
  getStorageSync(key) {
    return global.wx._store.get(key);
  },
  setStorageSync(key, value) {
    global.wx._store.set(key, value);
  },
  removeStorageSync(key) {
    global.wx._store.delete(key);
  }
};

// Clear mock store between requires to get a fresh start
global.wx._store.clear();

const drawStorage = require("../utils/drawStorage");

// --- Tests ---

// 1. ensureDefaultPool creates a default pool when empty
const poolsBefore = drawStorage.getPools();
assert.equal(poolsBefore.length, 0, "初始卡池列表应为空");

const defaultPool = drawStorage.ensureDefaultPool();
assert.equal(defaultPool.name, "主卡池");
assert.equal(drawStorage.getPools().length, 1);

// 2. createPool adds a new pool
const pkPool = drawStorage.createPool("PK赛季卡池");
assert.equal(pkPool.name, "PK赛季卡池");
assert.equal(drawStorage.getPools().length, 2);

// 3. getPityInfo starts at 0/30
const pity0 = drawStorage.getPityInfo(defaultPool.id);
assert.equal(pity0.current, 0);
assert.equal(pity0.total, 30);
assert.equal(pity0.guaranteedAt, null);

// 4. addRecord increments pity counter
drawStorage.addRecord(defaultPool.id, { quality: "blue", generalName: "张辽", drawType: "free", group: 1 });
drawStorage.addRecord(defaultPool.id, { quality: "purple", generalName: "夏侯惇", drawType: "half", group: 1 });
const pity2 = drawStorage.getPityInfo(defaultPool.id);
assert.equal(pity2.current, 2);
assert.equal(pity2.guaranteedAt, 2);

// 5. Orange card resets pity counter
drawStorage.addRecord(defaultPool.id, { quality: "orange", generalName: "曹操", drawType: "free", group: 2 });
const pityReset = drawStorage.getPityInfo(defaultPool.id);
assert.equal(pityReset.current, 0);
assert.equal(pityReset.guaranteedAt, null);

// 6. Records after orange start fresh count
drawStorage.addRecord(defaultPool.id, { quality: "blue", generalName: "李典", drawType: "half", group: 2 });
const pityAfterOrange = drawStorage.getPityInfo(defaultPool.id);
assert.equal(pityAfterOrange.current, 1);

// 7. deleteRecord works
const records = drawStorage.getRecords(defaultPool.id);
const recordId = records[records.length - 1].id;
drawStorage.deleteRecord(defaultPool.id, recordId);
const pityAfterDelete = drawStorage.getPityInfo(defaultPool.id);
assert.equal(pityAfterDelete.current, 0);

// 8. Different pools have independent pity counters
drawStorage.addRecord(pkPool.id, { quality: "blue", generalName: "赵云", drawType: "free", group: 1 });
drawStorage.addRecord(pkPool.id, { quality: "blue", generalName: "黄忠", drawType: "half", group: 1 });
const pkPity = drawStorage.getPityInfo(pkPool.id);
const defaultPity = drawStorage.getPityInfo(defaultPool.id);
assert.equal(pkPity.current, 2);
assert.equal(defaultPity.current, 0);

// 9. deletePool removes pool and its records
drawStorage.deletePool(pkPool.id);
assert.equal(drawStorage.getPools().length, 1);
assert.equal(drawStorage.getRecords(pkPool.id).length, 0);

// 10. Seasons have independent pity counters
const seasonPool = drawStorage.createPool("赛季独立测试卡池");
const season1 = drawStorage.createSeason("测试S1");
drawStorage.addRecord(seasonPool.id, { quality: "blue", generalName: "许褚", drawType: "free", group: 1 });
drawStorage.addRecord(seasonPool.id, { quality: "purple", generalName: "郭嘉", drawType: "half", group: 1 });
assert.equal(drawStorage.getPityInfo(seasonPool.id, season1.id).current, 2);
assert.equal(drawStorage.getSeasonStats(seasonPool.id, season1.id).totalDraws, 2);

const season2 = drawStorage.createSeason("测试S2");
assert.equal(drawStorage.getPityInfo(seasonPool.id, season2.id).current, 0);
drawStorage.addRecord(seasonPool.id, { quality: "blue", generalName: "马岱", drawType: "free", group: 2 });
assert.equal(drawStorage.getPityInfo(seasonPool.id, season2.id).current, 1);
assert.equal(drawStorage.getPityInfo(seasonPool.id, season1.id).current, 2);

drawStorage.addRecord(seasonPool.id, { quality: "orange", generalName: "赵云", drawType: "half", group: 2 });
assert.equal(drawStorage.getPityInfo(seasonPool.id, season2.id).current, 0);
assert.equal(drawStorage.getSeasonStats(seasonPool.id, season2.id).orangeCount, 1);

drawStorage.endCurrentSeason();
const season3 = drawStorage.ensureDefaultSeason();
assert.notEqual(season3.id, season2.id);
assert.equal(drawStorage.getPityInfo(seasonPool.id, season3.id).current, 0);

// 11. Season start date supports next season estimate
const forecastSeason = drawStorage.createSeason("时间预测S", "2026-01-01");
let forecast = drawStorage.getNextSeasonEstimate(forecastSeason.id);
assert.equal(drawStorage.SEASON_LENGTH_DAYS, 75);
assert.equal(forecast.startDate, "2026-01-01");
assert.equal(forecast.estimateDate, "2026-03-17");
assert.equal(forecast.lengthDays, 75);

const updatedSeason = drawStorage.updateSeasonStartDate(forecastSeason.id, "2026-02-01");
assert.equal(updatedSeason.startDate, "2026-02-01");
forecast = drawStorage.getNextSeasonEstimate(forecastSeason.id);
assert.equal(forecast.estimateDate, "2026-04-17");
assert.equal(drawStorage.updateSeasonStartDate(forecastSeason.id, "2026-02-31"), null);
assert.equal(drawStorage.getNextSeasonEstimate(forecastSeason.id).estimateDate, "2026-04-17");

// 12. getDrawWindow returns a result with activeGroup
const window = drawStorage.getDrawWindow();
assert.ok("activeGroup" in window);
assert.ok("group1Open" in window);
assert.ok("group2Open" in window);

// 13. buildCalendarDays returns correct structure
const cal = drawStorage.buildCalendarDays(defaultPool.id, 2026, 6);
assert.ok(Array.isArray(cal.days));
assert.ok(cal.days.length >= 28);
assert.equal(typeof cal.totalDraws, "number");
assert.equal(typeof cal.orangeCount, "number");

// 14. getDrawDate returns a valid date string
const drawDate = drawStorage.getDrawDate();
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(drawDate));

console.log("drawStorage: 全部测试通过。");
