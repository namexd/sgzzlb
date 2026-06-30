<template>
  <view v-if="visible" class="picker-mask" @tap="onMaskTap">
    <view class="picker-content" @tap.stop>
      <view class="picker-header">
        <text class="picker-title">{{ type === 'generals' ? '选择武将' : '选择战法' }}</text>
        <text class="picker-close" @tap="onCloseTap">✕</text>
      </view>

      <input
        class="picker-search"
        :placeholder="type === 'generals' ? '搜索武将' : '搜索战法'"
        :value="keyword"
        @input="onKeywordInput"
        confirm-type="search"
        :focus="visible"
      />

      <view class="picker-chips">
        <text
          v-for="chip in chips"
          :key="chip"
          :class="['chip', activeChip === chip ? 'active' : '']"
          @tap="onChipTap(chip)"
        >{{ chip }}</text>
      </view>

      <view class="picker-actions">
        <text class="action-chip" @tap="onSelectFilteredTap">全选当前筛选</text>
        <template v-if="type === 'generals'">
          <text
            v-for="faction in factionOptions"
            :key="faction"
            class="action-chip"
            @tap="onSelectFactionTap(faction)"
          >全选{{ faction }}</text>
        </template>
      </view>

      <view class="picker-count">{{ filtered.length }} / {{ totalCount }}</view>

      <scroll-view class="picker-list" scroll-y>
        <view
          v-for="item in filtered"
          :key="item.id"
          :class="['picker-item', item.selected ? 'selected' : '']"
          @tap="onItemTap(item.id)"
        >
          <image v-if="item.imageUrl" class="item-thumb" :src="item.imageUrl" mode="aspectFill" />
          <view class="item-main">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-sub">{{ item.sub }}</text>
          </view>
          <text v-if="item.selected" class="item-check">✓</text>
        </view>
        <view v-if="filtered.length === 0" class="picker-empty">未匹配</view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import catalog from "../utils/catalog";

const FACTION_CHIPS = ["全部", "魏", "蜀", "吴", "群"];
const QUALITY_CHIPS = ["全部", "S", "A", "B"];
const DISPLAY_LIMIT = 100;

export default {
  props: {
    type: { type: String, default: "generals" },
    selectedId: { type: String, default: "" },
    excludeIds: { type: Array, default: () => [] },
    items: { type: Array, default: () => [] },
    visible: { type: Boolean, default: false }
  },
  emits: ["select", "select-many", "close"],
  data() {
    return { keyword: "", filtered: [], filteredSource: [], chips: [], activeChip: "全部", totalCount: 0, factionOptions: ["魏", "蜀", "吴", "群"] };
  },
  watch: {
    visible(val) { if (val) this.refresh(); },
    type() { if (this.visible) this.refresh(); },
    items() { if (this.visible) this.applyFilter(); },
    excludeIds() { if (this.visible) this.applyFilter(); }
  },
  methods: {
    refresh() {
      const isGeneral = this.type === "generals";
      this.chips = isGeneral ? FACTION_CHIPS : QUALITY_CHIPS;
      this.activeChip = "全部";
      this.keyword = "";
      this.applyFilter();
    },
    applyFilter() {
      const isGeneral = this.type === "generals";
      let pool = this.items.length ? this.items : (isGeneral ? catalog.getGenerals() : catalog.getAllTactics());

      if (this.activeChip !== "全部") {
        if (isGeneral) {
          pool = pool.filter((item) => item.faction === this.activeChip);
        } else {
          pool = pool.filter((item) => item.quality === this.activeChip);
        }
      }

      const kw = this.keyword.trim().toLowerCase();
      if (kw) {
        pool = pool.filter((item) => {
          const body = [item.name, item.faction, item.quality, item.type, item.source, item.sourceGeneral, Array.isArray(item.tags) ? item.tags.join(" ") : ""].filter(Boolean).join(" ");
          return body.toLowerCase().includes(kw);
        });
      }

      const excluded = new Set(this.excludeIds);
      this.filteredSource = pool;
      this.totalCount = pool.length;
      this.filtered = pool.slice(0, DISPLAY_LIMIT).map((item) => ({
        id: item.id,
        name: item.name,
        selected: item.id === this.selectedId || excluded.has(item.id),
        imageUrl: isGeneral && item.asset ? item.asset.imageUrl || "" : "",
        sub: isGeneral
          ? [item.star, Array.isArray(item.tags) ? item.tags.join("/") : ""].filter(Boolean).join(" · ")
          : `${item.quality || "-"} · ${item.type || "战法"}${item.troopLimit ? " · " + (Array.isArray(item.troopLimit) ? item.troopLimit.join("/") : item.troopLimit) : ""}`
      }));
    },
    onKeywordInput(e) {
      this.keyword = e.detail.value;
      this.applyFilter();
    },
    onChipTap(chip) {
      this.activeChip = chip;
      this.applyFilter();
    },
    onItemTap(id) {
      this.$emit("select", { id });
    },
    emitMany(items) {
      const excluded = new Set(this.excludeIds);
      const ids = items.map((item) => item.id).filter((id) => id && !excluded.has(id));
      if (ids.length) this.$emit("select-many", { ids });
    },
    onSelectFilteredTap() {
      this.emitMany(this.filteredSource);
    },
    onSelectFactionTap(faction) {
      const pool = this.items.length ? this.items : catalog.getGenerals();
      this.emitMany(pool.filter((item) => item.faction === faction));
    },
    onMaskTap() {
      this.$emit("close");
    },
    onCloseTap() {
      this.$emit("close");
    }
  }
};
</script>

<style scoped>
.picker-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.picker-content {
  width: 100%;
  max-height: 80vh;
  background: #1a2332;
  border-radius: 24rpx 24rpx 0 0;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.picker-title { color: #f7e4bc; font-size: 32rpx; font-weight: 700; }
.picker-close { color: #8d97a5; font-size: 36rpx; padding: 10rpx; }
.picker-search {
  width: 100%;
  height: 76rpx;
  padding: 0 24rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.3);
  border-radius: 8rpx;
  background: rgba(8, 12, 18, 0.5);
  color: #f4ead8;
  font-size: 28rpx;
  box-sizing: border-box;
}
.picker-chips { display: flex; gap: 14rpx; margin-top: 18rpx; flex-wrap: wrap; }
.chip {
  padding: 8rpx 24rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.2);
  color: #8d97a5;
  font-size: 24rpx;
}
.chip.active {
  border-color: #d6a85d;
  color: #d6a85d;
  background: rgba(214, 168, 93, 0.12);
}
.picker-count { margin-top: 14rpx; color: #6b7a8d; font-size: 22rpx; }
.picker-actions { display: flex; gap: 12rpx; margin-top: 16rpx; flex-wrap: wrap; }
.action-chip {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(214, 168, 93, 0.45);
  color: #f7e4bc;
  background: rgba(214, 168, 93, 0.12);
  font-size: 23rpx;
  font-weight: 600;
}
.picker-list { margin-top: 14rpx; max-height: 50vh; }
.picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 16rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}
.picker-item.selected { background: rgba(214, 168, 93, 0.1); border-radius: 8rpx; }
.item-thumb { width: 64rpx; height: 64rpx; border-radius: 8rpx; margin-right: 16rpx; flex-shrink: 0; }
.item-main { display: flex; flex-direction: column; gap: 6rpx; }
.item-name { color: #f4ead8; font-size: 28rpx; font-weight: 600; }
.item-sub { color: #8d97a5; font-size: 22rpx; }
.item-check { color: #d6a85d; font-size: 32rpx; font-weight: 700; }
.picker-empty { text-align: center; color: #6b7a8d; font-size: 26rpx; padding: 60rpx 0; }
.picker-hint { color: #6b7a8d; font-size: 20rpx; margin-top: 4rpx; }
</style>
