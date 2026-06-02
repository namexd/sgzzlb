function getFactionTone(faction) {
  const tones = {
    魏: { name: "玄铁蓝", primary: "#334b63", accent: "#d2b074" },
    蜀: { name: "松柏绿", primary: "#2e5b46", accent: "#d7bd75" },
    吴: { name: "赤铜红", primary: "#743c38", accent: "#e0b66c" },
    群: { name: "烟金紫", primary: "#544262", accent: "#d8b46a" }
  };
  return tones[faction] || { name: "暗金", primary: "#3f4652", accent: "#d6a85d" };
}

function getOriginalCardStyle(general) {
  const tone = getFactionTone(general && general.faction);
  return {
    background: `linear-gradient(155deg, ${tone.primary} 0%, #171c23 58%, #0e1218 100%)`,
    borderColor: tone.accent,
    toneName: tone.name,
    badge: general && general.faction ? general.faction : "将",
    initial: general && general.name ? general.name.slice(0, 1) : "+"
  };
}

function getGenerationPolicy() {
  return {
    model: "image2",
    policy: "original_style_only",
    forbiddenInputs: ["官网图", "游戏立绘", "竞品截图", "官方卡框", "可混淆构图"],
    requiredReview: ["相似度审核", "来源记录", "人工验收"]
  };
}

module.exports = {
  getFactionTone,
  getOriginalCardStyle,
  getGenerationPolicy
};
