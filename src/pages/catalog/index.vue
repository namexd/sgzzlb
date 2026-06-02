<template>
  <view class="page catalog-page">
    <view class="section">
      <view class="title">资料库</view>
      <view class="subtitle">{{ dataSource }}来自官方公开资料库；页面不加载官网图片资源。</view>
    </view>

    <view class="section stat-line">
      <text class="pill">武将 {{ meta.generalsCount }}</text>
      <text class="pill">战法 {{ meta.tacticsCount }}</text>
      <text class="pill">装备 {{ meta.equipmentCount }}</text>
      <text class="pill">兵种 {{ meta.troopTacticsCount }}</text>
    </view>

    <view class="section tabs">
      <view
        v-for="item in tabs"
        :key="item.key"
        :class="['tab', { active: activeTab === item.key }]"
        @tap="switchTab(item.key)"
      >
        {{ item.name }}
      </view>
    </view>

    <view class="section">
      <input
        class="search"
        placeholder="搜索武将、战法、来源、标签"
        :value="keyword"
        @input="onKeywordInput"
      />
    </view>

    <view class="section muted count">
      显示 {{ recordsView.length }} / {{ records.length }} 条
      <text v-if="loadStatus" class="sync-status"> · {{ loadStatus }}</text>
    </view>

    <view class="records">
      <view v-if="!recordsView.length" class="empty">没有匹配结果</view>
      <view v-for="item in recordsView" :key="item.id" class="record band">
        <view class="record-main">
          <image v-if="item.imageUrl" class="record-thumb" :src="item.imageUrl" mode="aspectFill" />
          <view class="record-body">
            <view class="row-between">
              <view class="record-title">{{ item.title }}</view>
              <text class="pill">{{ item.badge }}</text>
            </view>
            <view class="record-line">{{ item.line1 }}</view>
            <view class="record-line">{{ item.line2 }}</view>
            <view v-if="item.desc" class="record-desc">{{ item.desc }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import {
  searchRecords,
  getGenerals,
  getTactics,
  getEquipment,
  getTroopTactics
} from "../../utils/catalog";
import { getRecords, getCatalogSummary, isRemoteMode } from "../../services/api";

const TABS = [
  { key: "generals", name: "武将" },
  { key: "tactics", name: "战法" },
  { key: "equipment", name: "装备" },
  { key: "troopTactics", name: "兵种" }
];

export default {
  data() {
    return {
      tabs: TABS,
      activeTab: "generals",
      keyword: "",
      records: [],
      recordsView: [],
      meta: {},
      dataSource: "本地快照",
      loadStatus: ""
    };
  },

  onLoad() {
    this.meta = getCatalogSummary();
    this.refreshRecords();
  },

  onShow() {
    this.refreshRecords();
  },

  methods: {
    switchTab(key) {
      this.activeTab = key;
      this.keyword = "";
      this.refreshRecords();
    },

    onKeywordInput(event) {
      this.keyword = event.detail.value;
      this.refreshRecords();
    },

    refreshRecords() {
      const activeTab = this.activeTab;
      const keyword = this.keyword;
      const remote = isRemoteMode();
      this.loadStatus = remote ? "正在读取远程资料..." : "";
      this.dataSource = remote ? "远程 API" : "本地快照";

      const loader = Promise.resolve(getRecords(activeTab, { keyword }));

      loader
        .then((records) => {
          this.records = records;
          this.recordsView = records.slice(0, 80).map((record) => this.toView(record));
          this.loadStatus = remote ? "已同步远程资料。" : "";
        })
        .catch((error) => {
          const fallback = searchRecords(activeTab, keyword);
          this.records = fallback;
          this.recordsView = fallback.slice(0, 80).map((record) => this.toView(record));
          this.dataSource = "本地快照";
          this.loadStatus = `远程资料读取失败，已回退本地快照：${error.message || error}`;
        });
    },

    toView(record) {
      if (this.activeTab === "generals") {
        return {
          id: record.id,
          title: record.name,
          badge: record.faction || "武将",
          imageUrl: record.asset && record.asset.imageUrl ? record.asset.imageUrl : "",
          line1: (record.cost || "-") + "御 · " + (record.star || "-") + " · " + ((record.tags && record.tags.join(" / ")) || "未标记"),
          line2: "骑" + ((record.arms && record.arms.cavalry) || "-") + " 盾" + ((record.arms && record.arms.shield) || "-") + " 弓" + ((record.arms && record.arms.bow) || "-") + " 枪" + ((record.arms && record.arms.spear) || "-"),
          desc: "自带：" + ((record.tactics && record.tactics.innate) || "-") + "；传承：" + ((record.tactics && record.tactics.inherited) || "-"),
        };
      }
      if (this.activeTab === "tactics" || this.activeTab === "troopTactics") {
        return {
          id: record.id,
          title: record.name,
          badge: record.quality || "战法",
          line1: (record.type || "-") + " · " + (record.source || "-") + " · 来源 " + (record.sourceGeneral || "-"),
          line2: "限制：" + ((record.troopLimit && record.troopLimit.join(" / ")) || "不限"),
          desc: this.clip(record.description || "暂无描述"),
          assetStatus: record.asset && record.asset.status === "needs_generation" ? "待生成原创图标" : "已审核"
        };
      }
      return {
        id: record.id,
        title: record.name,
        badge: record.quality || "装备",
        line1: (record.type || "-") + " · " + (record.effect || "暂无特技"),
        line2: "官方图片字段未进入小程序包",
        desc: "",
        assetStatus: "文字资料"
      };
    },

    clip(text) {
      var value = String(text || "");
      return value.length > 96 ? value.slice(0, 96) + "..." : value;
    }
  }
};
</script>

<style scoped>
.catalog-page {
  min-height: 100vh;
  padding: 24rpx;
}

.stat-line {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
}

.tab {
  height: 64rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9da8b6;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  font-size: 25rpx;
}

.tab.active {
  color: #1b1408;
  background: #d6a85d;
  border-color: #d6a85d;
  font-weight: 700;
}

.search {
  height: 76rpx;
  padding: 0 22rpx;
  border-radius: 8rpx;
  color: #f7e8cf;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  font-size: 26rpx;
}

.count {
  font-size: 22rpx;
}

.sync-status {
  color: #d6a85d;
}

.records {
  display: grid;
  gap: 16rpx;
}

.record-main {
  display: flex;
  gap: 16rpx;
}

.record-thumb {
  width: 120rpx;
  height: 160rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  border: 1rpx solid rgba(214, 168, 93, 0.25);
}

.record-body {
  flex: 1;
  min-width: 0;
}

.record-title {
  max-width: 480rpx;
  color: #f7e4bc;
  font-size: 30rpx;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-line,
.record-desc {
  margin-top: 10rpx;
  color: #b9c2cf;
  font-size: 24rpx;
  line-height: 1.55;
}

.asset-status {
  margin-top: 14rpx;
  color: #d6a85d;
  font-size: 22rpx;
}

/* Global theme classes used in template */
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: linear-gradient(180deg, #17202a 0%, #10151c 62%, #0f141a 100%);
  color: #f4ead8;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.section {
  margin-bottom: 24rpx;
}

.band {
  padding: 24rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.22);
  background: rgba(249, 239, 216, 0.06);
  border-radius: 8rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f7e4bc;
  line-height: 1.25;
}

.subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #98a3b3;
  line-height: 1.55;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding: 0 16rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.34);
  border-radius: 6rpx;
  color: #f1d29a;
  font-size: 22rpx;
  background: rgba(214, 168, 93, 0.08);
}

.muted {
  color: #8d97a5;
}

.empty {
  padding: 40rpx 20rpx;
  text-align: center;
  color: #8d97a5;
}
</style>
