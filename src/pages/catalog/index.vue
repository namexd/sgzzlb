<template>
  <view class="page catalog-page">
    <view class="section">
      <view class="title">资料库</view>
      <view class="subtitle">收录武将、战法、装备和兵种资料。</view>
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
      共 {{ records.length }} 条
    </view>

    <view class="records">
      <view v-if="!recordsView.length" class="empty">没有匹配结果</view>
      <view v-for="item in recordsView" :key="item.id" class="record band">
        <view class="record-main">
          <image v-if="item.imageUrl" class="record-thumb" :src="item.imageUrl" mode="widthFix" />
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
      <view v-if="recordsView.length < records.length" class="load-more" @tap="loadMore">
        加载更多（{{ recordsView.length }}/{{ records.length }}）
      </view>
    </view>

    <view class="feedback-entry" @tap="goToFeedback">对功能有意见？去反馈 →</view>
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
        };
      }
      return {
        id: record.id,
        title: record.name,
        badge: record.quality || "装备",
        line1: (record.type || "-") + " · " + (record.effect || "暂无特技"),
        line2: "",
        desc: "",
      };
    },

    clip(text) {
      var value = String(text || "");
      return value.length > 96 ? value.slice(0, 96) + "..." : value;
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
  padding: var(--sp-lg);
  padding-bottom: 60rpx;
}

.section {
  margin-bottom: var(--sp-lg);
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
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-stone);
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  font-size: 25rpx;
  transition: all var(--ease);
}

.tab.active {
  color: var(--ink-deepest);
  background: var(--gold);
  border-color: var(--gold);
  font-weight: 700;
}

.search {
  height: 76rpx;
  padding: 0 22rpx;
  border-radius: var(--r-md);
  color: var(--text-ink);
  background: var(--ink-surface);
  border: 1rpx solid var(--border-faint);
  font-size: 26rpx;
  transition: border-color var(--ease);
}

.count {
  font-size: 22rpx;
}

.records {
  display: grid;
  gap: var(--sp-md);
}

.record-main {
  display: flex;
  gap: var(--sp-md);
}

.record-thumb {
  width: 120rpx;
  border-radius: var(--r-md);
  flex-shrink: 0;
  border: 1rpx solid var(--border-accent);
}

.record-body {
  flex: 1;
  min-width: 0;
}

.record-title {
  max-width: 480rpx;
  color: var(--gold-bright);
  font-size: 30rpx;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-line,
.record-desc {
  margin-top: 10rpx;
  color: var(--text-ink);
  font-size: 24rpx;
  line-height: 1.55;
}

.band {
  padding: var(--sp-lg);
  border: 1rpx solid var(--border-accent);
  background: var(--ink-surface);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--ease);
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--gold-bright);
  line-height: 1.25;
}

.subtitle {
  margin-top: var(--sp-xs);
  font-size: 24rpx;
  color: var(--text-stone);
  line-height: 1.55;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-md);
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding: 0 var(--sp-md);
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-sm);
  color: var(--gold);
  font-size: 22rpx;
  background: var(--gold-ghost);
}

.muted {
  color: var(--text-stone);
}

.empty {
  padding: 40rpx 20rpx;
  text-align: center;
  color: var(--text-stone);
}

.load-more {
  padding: var(--sp-lg);
  text-align: center;
  color: var(--gold);
  font-size: 26rpx;
  border: 1rpx solid var(--border-accent);
  border-radius: var(--r-md);
  background: var(--gold-ghost);
  transition: all var(--ease);
}

@media screen and (min-width: 768px) {
  .record-thumb {
    width: 160rpx;
  }

  .record-title {
    font-size: 34rpx;
  }

  .record-line,
  .record-desc {
    font-size: 28rpx;
  }

  .tab {
    height: 76rpx;
    font-size: 28rpx;
  }

  .search {
    height: 88rpx;
    font-size: 30rpx;
  }
}

.feedback-entry {
  text-align: center;
  color: var(--text-fade);
  font-size: 24rpx;
  padding: var(--sp-xl) 0 var(--sp-md);
}
</style>
