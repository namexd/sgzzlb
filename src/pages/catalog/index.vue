<template>
  <view class="page catalog-page">
    <view class="catalog-bg"></view>

    <view class="topbar">
      <view class="title-wrap">
        <image class="title-ornament" src="/static/ui-assets/mockup-icons/title-ornament-left.png" mode="aspectFit" />
        <view class="page-title">武将图鉴</view>
        <image class="title-ornament" src="/static/ui-assets/mockup-icons/title-ornament-right.png" mode="aspectFit" />
      </view>
    </view>

    <view class="tabs">
      <view
        v-for="item in tabs"
        :key="item.key"
        :class="['tab', { active: activeTab === item.key }]"
        @tap="switchTab(item.key)"
      >
        {{ item.name }}
      </view>
    </view>

    <view class="search-row">
      <input
        class="search"
        :placeholder="activeTab === 'generals' ? '搜索武将' : '搜索名称'"
        :value="keyword"
        @input="onKeywordInput"
      />
    </view>

    <view class="records-list">
      <view v-if="!recordsView.length" class="empty">未匹配</view>
      <view
        v-for="item in recordsView"
        :key="item.id"
        :class="['record-card', { general: activeTab === 'generals' }]"
      >
        <view v-if="activeTab === 'generals'" class="general-cover" @tap.stop="previewImage(item.imageUrl)">
          <image v-if="item.imageUrl" class="general-img" :src="item.imageUrl" mode="aspectFit" />
          <view v-else class="general-img-placeholder">
            <text>{{ item.title.slice(0, 1) }}</text>
          </view>
        </view>
        <view class="record-main">
          <view class="record-head">
            <view class="record-title">{{ item.title }}</view>
            <view class="record-badge" :class="item.faction">{{ item.badge }}</view>
          </view>
          <view class="record-meta">{{ item.line1 }}</view>
          <view v-if="item.arms && item.arms.length" class="arms-row">
            <view v-for="arm in item.arms" :key="arm.label" class="arm-chip">
              <text>{{ arm.label }}</text><text>{{ arm.value }}</text>
            </view>
          </view>
          <view v-if="item.tactics && item.tactics.length" class="tactic-list">
            <view v-for="tactic in item.tactics" :key="tactic.label" class="tactic-line">
              <text class="tactic-label">{{ tactic.label }}</text>
              <view class="tactic-copy">
                <text class="tactic-name">{{ tactic.name }}</text>
                <text v-if="tactic.desc" class="tactic-desc">{{ tactic.desc }}</text>
              </view>
            </view>
          </view>
          <view v-if="item.desc" class="record-desc">{{ item.desc }}</view>
        </view>
      </view>
    </view>

    <view v-if="recordsView.length < records.length" class="load-more" @tap="loadMore">
      加载更多
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
import { getRecords, getCatalogSummary } from "../../services/api";

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
      displayLimit: 80,
      meta: {}
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
      this.displayLimit = 80;

      Promise.resolve(getRecords(activeTab, { keyword }))
        .then((records) => {
          this.records = records;
          this.recordsView = records.slice(0, this.displayLimit).map((record) => this.toView(record));
        })
        .catch(() => {
          const fallback = searchRecords(activeTab, keyword);
          this.records = fallback;
          this.recordsView = fallback.slice(0, this.displayLimit).map((record) => this.toView(record));
        });
    },

    loadMore() {
      this.displayLimit += 80;
      this.recordsView = this.records.slice(0, this.displayLimit).map((record) => this.toView(record));
    },

    toView(record) {
      if (this.activeTab === "generals") {
        const imageUrl = record.asset && record.asset.imageUrl ? record.asset.imageUrl : "";
        const innate = (record.tactics && record.tactics.innate) || "";
        const inherited = (record.tactics && record.tactics.inherited) || "";
        return {
          id: record.id,
          title: record.name,
          badge: record.star || "武将",
          faction: record.faction || "群",
          cost: record.cost || "",
          imageUrl,
          line1: [(record.tags && record.tags.join(" / ")), record.season].filter(Boolean).join(" · ") || "武将档案",
          arms: [
            { label: "骑", value: (record.arms && record.arms.cavalry) || "-" },
            { label: "盾", value: (record.arms && record.arms.shield) || "-" },
            { label: "弓", value: (record.arms && record.arms.bow) || "-" },
            { label: "枪", value: (record.arms && record.arms.spear) || "-" },
            { label: "械", value: (record.arms && record.arms.siege) || "-" }
          ],
          tactics: [
            { label: "自带", name: innate, desc: this.clip(this.cleanText((record.tactics && record.tactics.innateDescription) || ""), 42) },
            { label: "传承", name: inherited, desc: this.clip(this.cleanText((record.tactics && record.tactics.inheritedDescription) || ""), 42) }
          ].filter((item) => item.name),
          desc: this.clip(this.cleanText(this.getRawDetail(record, "列传")), 54)
        };
      }
      if (this.activeTab === "tactics" || this.activeTab === "troopTactics") {
        return {
          id: record.id,
          title: record.name,
          badge: record.quality || "战法",
          faction: record.quality || "战",
          cost: "",
          imageUrl: "",
          line1: (record.type || "-") + " · " + (record.source || "-") + " · 来源 " + (record.sourceGeneral || "-"),
          arms: [],
          tactics: [],
          desc: this.clip(record.description || "", 120),
        };
      }
      return {
        id: record.id,
        title: record.name,
        badge: record.quality || "装备",
        faction: "装",
        cost: "",
        imageUrl: "",
        line1: [record.type, record.effect].filter(Boolean).join(" · "),
        arms: [],
        tactics: [],
        desc: this.clip(record.description || "", 120),
      };
    },

    getRawDetail(record, key) {
      const detail = (record.rawDetails || []).find((item) => item.key === key);
      return detail ? detail.value : "";
    },

    clip(text, limit = 96) {
      var value = String(text || "");
      return value.length > limit ? value.slice(0, limit) + "..." : value;
    },

    cleanText(text) {
      return String(text || "")
        .replace(/\{[^}]+\}/g, "")
        .replace(/\s+/g, " ")
        .trim();
    },

    previewImage(url) {
      if (!url) return;
      uni.previewImage({ urls: [url], current: url });
    },

    goToFeedback() {
      uni.navigateTo({ url: "/pages/feedback/index" });
    }
  }
};
</script>

<style scoped>
.catalog-page {
  min-height: 100vh;
  padding: 74rpx 30rpx 138rpx;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -8%, rgba(90, 160, 240, 0.34), transparent 34%),
    radial-gradient(circle at 12% 28%, rgba(244, 213, 139, 0.12), transparent 24%),
    linear-gradient(180deg, rgba(10, 28, 52, 0.94) 0%, rgba(8, 31, 58, 0.98) 48%, #0d2745 100%),
    linear-gradient(120deg, #0b1b2f 0%, #163a5e 52%, #10233b 100%);
}

.catalog-bg {
  position: fixed;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 64rpx 64rpx;
  opacity: 0.22;
  pointer-events: none;
}

.topbar,
.tabs,
.search-row,
.records-list,
.load-more {
  position: relative;
  z-index: 1;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.title-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 10rpx;
}

.title-ornament {
  width: 54rpx;
  height: 18rpx;
  opacity: 0.9;
}

.page-title {
  color: transparent;
  font-size: 40rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #fff0b8 0%, #d9ad4d 58%, #fff3bd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 18rpx rgba(244, 213, 139, 0.26), 0 8rpx 22rpx rgba(0, 0, 0, 0.5);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 28rpx;
  overflow: hidden;
  border: 1rpx solid rgba(128, 180, 236, 0.28);
  border-radius: 7rpx;
  background: rgba(18, 51, 87, 0.78);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.14),
    inset 0 -18rpx 30rpx rgba(2, 9, 19, 0.28),
    0 10rpx 22rpx rgba(0, 0, 0, 0.22);
}

.tabs::before,
.search-row::before {
  content: "";
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  top: -1rpx;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(244, 213, 139, 0.72), transparent);
  pointer-events: none;
}

.tab {
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b5c5d8;
  font-size: 28rpx;
  border-right: 1rpx solid rgba(255, 255, 255, 0.08);
}

.tab:last-child {
  border-right: 0;
}

.tab.active {
  color: #fff0bc;
  font-weight: 900;
  background: linear-gradient(180deg, rgba(244, 213, 139, 0.4), rgba(49, 71, 88, 0.24));
}

.search-row {
  margin-bottom: 28rpx;
}

.search {
  height: 64rpx;
  border-radius: 7rpx;
  border: 1rpx solid rgba(105, 151, 202, 0.3);
  background: rgba(6, 20, 35, 0.82);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12),
    inset 0 -14rpx 26rpx rgba(0, 0, 0, 0.24),
    0 8rpx 18rpx rgba(0, 0, 0, 0.2);
}

.search {
  padding: 0 18rpx;
  color: #dce8f5;
  font-size: 24rpx;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.empty {
  padding: 60rpx 20rpx;
  text-align: center;
  color: #7d91a6;
  font-size: 28rpx;
}

.record-card {
  position: relative;
  min-height: 204rpx;
  overflow: hidden;
  border-radius: 7rpx;
  background:
    linear-gradient(#0c1724, #0c1724) padding-box,
    linear-gradient(145deg, #f7d486 0%, #4f86c9 35%, #141d2b 50%, #d5aa55 100%) border-box;
  border: 1rpx solid transparent;
  box-shadow:
    0 12rpx 28rpx rgba(0, 0, 0, 0.34),
    0 0 18rpx rgba(62, 132, 220, 0.2),
    inset 0 0 0 1rpx rgba(255, 245, 199, 0.1);
  padding: 16rpx;
  display: flex;
  gap: 18rpx;
}

.record-card:active {
  transform: scale(0.98);
}

.record-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 12;
  pointer-events: none;
  background:
    linear-gradient(90deg, #f4d58b 0 18rpx, transparent 18rpx) left top / 56rpx 2rpx no-repeat,
    linear-gradient(#f4d58b 0 18rpx, transparent 18rpx) left top / 2rpx 56rpx no-repeat,
    linear-gradient(270deg, #f4d58b 0 18rpx, transparent 18rpx) right top / 56rpx 2rpx no-repeat,
    linear-gradient(#f4d58b 0 18rpx, transparent 18rpx) right top / 2rpx 56rpx no-repeat,
    linear-gradient(90deg, #f4d58b 0 18rpx, transparent 18rpx) left bottom / 56rpx 2rpx no-repeat,
    linear-gradient(0deg, #f4d58b 0 18rpx, transparent 18rpx) left bottom / 2rpx 56rpx no-repeat,
    linear-gradient(270deg, #f4d58b 0 18rpx, transparent 18rpx) right bottom / 56rpx 2rpx no-repeat,
    linear-gradient(0deg, #f4d58b 0 18rpx, transparent 18rpx) right bottom / 2rpx 56rpx no-repeat;
  opacity: 0.72;
}

.record-card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.16) 0%, transparent 22%, transparent 72%, rgba(255, 230, 150, 0.08) 100%),
    radial-gradient(circle at 50% 0%, rgba(255, 230, 154, 0.18), transparent 38%);
  mix-blend-mode: screen;
}

.general-cover {
  position: relative;
  z-index: 3;
  flex: 0 0 154rpx;
  height: 206rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(244, 213, 139, 0.34);
  background: linear-gradient(160deg, rgba(14, 31, 48, 0.88), rgba(5, 12, 20, 0.95));
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.general-img {
  width: 100%;
  height: 100%;
  display: block;
}

.general-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #223950 0%, #0c1624 100%);
}

.general-img-placeholder text {
  color: #f4d58b;
  font-size: 64rpx;
  font-weight: 900;
  text-shadow: 0 0 20rpx rgba(201, 152, 58, 0.5);
}

.record-main {
  position: relative;
  z-index: 3;
  min-width: 0;
  flex: 1;
  padding: 2rpx 0;
}

.record-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.record-title {
  color: #f5d979;
  font-size: 31rpx;
  font-weight: 900;
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.72);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-badge {
  flex-shrink: 0;
  min-width: 72rpx;
  height: 34rpx;
  padding: 0 10rpx;
  border-radius: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #eef6ff;
  font-size: 22rpx;
  background: rgba(79, 134, 201, 0.22);
  border: 1rpx solid rgba(244, 213, 139, 0.24);
}

.record-badge.蜀 {
  background: rgba(47, 132, 74, 0.28);
}

.record-badge.吴 {
  background: rgba(169, 67, 56, 0.28);
}

.record-badge.群 {
  background: rgba(126, 73, 162, 0.28);
}

.record-meta {
  margin-top: 8rpx;
  color: #c7d5e6;
  font-size: 23rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arms-row {
  display: flex;
  gap: 8rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}

.arm-chip {
  min-width: 48rpx;
  height: 34rpx;
  padding: 0 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  border-radius: 4rpx;
  color: #d7e2f0;
  background: rgba(255, 255, 255, 0.055);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  font-size: 21rpx;
}

.arm-chip text:last-child {
  color: #f0d38c;
  font-weight: 900;
}

.tactic-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 12rpx;
}

.tactic-line {
  display: grid;
  grid-template-columns: 54rpx minmax(0, 1fr);
  gap: 8rpx;
}

.tactic-label {
  height: 30rpx;
  border-radius: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0e1f32;
  background: linear-gradient(180deg, #f2d58d, #b7822d);
  font-size: 20rpx;
  font-weight: 900;
}

.tactic-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3rpx;
}

.tactic-name {
  color: #f3d58d;
  font-size: 23rpx;
  font-weight: 800;
}

.tactic-desc,
.record-desc {
  color: #9eb0c3;
  font-size: 21rpx;
  line-height: 1.42;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.tactic-desc {
  -webkit-line-clamp: 2;
}

.record-desc {
  margin-top: 12rpx;
  padding-top: 10rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
  -webkit-line-clamp: 2;
}

.load-more {
  margin-top: 32rpx;
  padding: 22rpx;
  text-align: center;
  color: #f4d58b;
  font-size: 26rpx;
  border: 1rpx solid rgba(218, 185, 111, 0.24);
  border-radius: 8rpx;
  background: rgba(7, 18, 31, 0.58);
}

@media screen and (min-width: 768px) {
  .records-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20rpx;
  }

  .general-cover {
    flex-basis: 168rpx;
    height: 224rpx;
  }
}
</style>
