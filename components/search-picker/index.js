const catalog = require("../../utils/catalog");

const FACTION_CHIPS = ["全部", "魏", "蜀", "吴", "群"];
const QUALITY_CHIPS = ["全部", "S", "A", "B"];
const DISPLAY_LIMIT = 60;

Component({
  properties: {
    type: { type: String, value: "generals" },
    selectedId: { type: String, value: "" },
    visible: { type: Boolean, value: false }
  },

  data: {
    keyword: "",
    filtered: [],
    chips: [],
    activeChip: "全部",
    totalCount: 0
  },

  observers: {
    visible(val) {
      if (val) this.refresh();
    },
    type() {
      if (this.data.visible) this.refresh();
    }
  },

  methods: {
    refresh() {
      const isGeneral = this.data.type === "generals";
      const chips = isGeneral ? FACTION_CHIPS : QUALITY_CHIPS;
      this.setData({ chips, activeChip: "全部", keyword: "" }, () => this.applyFilter());
    },

    applyFilter() {
      const isGeneral = this.data.type === "generals";
      let pool;
      if (isGeneral) {
        pool = catalog.getGenerals();
      } else {
        pool = catalog.getAllTactics();
      }

      const chip = this.data.activeChip;
      if (chip !== "全部") {
        if (isGeneral) {
          pool = pool.filter((item) => item.faction === chip);
        } else {
          pool = pool.filter((item) => item.quality === chip);
        }
      }

      const keyword = this.data.keyword.trim().toLowerCase();
      if (keyword) {
        pool = pool.filter((item) => {
          const body = [
            item.name,
            item.faction,
            item.quality,
            item.type,
            item.source,
            item.sourceGeneral,
            Array.isArray(item.tags) ? item.tags.join(" ") : ""
          ]
            .filter(Boolean)
            .join(" ");
          return body.toLowerCase().includes(keyword);
        });
      }

      this.setData({
        totalCount: pool.length,
        filtered: pool.slice(0, DISPLAY_LIMIT).map((item) => ({
          id: item.id,
          name: item.name,
          faction: item.faction || "",
          quality: item.quality || "",
          cost: item.cost || 0,
          type: item.type || "",
          troopLimit: Array.isArray(item.troopLimit) ? item.troopLimit.join("/") : (item.troopLimit || ""),
          selected: item.id === this.data.selectedId,
          imageUrl: isGeneral && item.asset ? item.asset.imageUrl || "" : "",
          sub: isGeneral
            ? `${item.faction || "?"} · ${item.cost || "?"}御`
            : `${item.quality || "-"} · ${item.type || "战法"}${item.troopLimit ? " · " + (Array.isArray(item.troopLimit) ? item.troopLimit.join("/") : item.troopLimit) : ""}`
        }))
      });
    },

    onKeywordInput(e) {
      this.setData({ keyword: e.detail.value }, () => this.applyFilter());
    },

    onChipTap(e) {
      const chip = e.currentTarget.dataset.chip;
      this.setData({ activeChip: chip }, () => this.applyFilter());
    },

    onItemTap(e) {
      const id = e.currentTarget.dataset.id;
      this.triggerEvent("select", { id });
    },

    onMaskTap() {
      this.triggerEvent("close");
    },

    onContentTap() {
      // prevent close when tapping inside content
    },

    onCloseTap() {
      this.triggerEvent("close");
    }
  }
});
