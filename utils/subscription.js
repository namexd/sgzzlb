const TIER_KEY = "subscriptionTier";
const ENTITLEMENTS_KEY = "cachedEntitlements";

function getLocalTier() {
  try {
    return wx.getStorageSync(TIER_KEY) || "free";
  } catch (error) {
    return "free";
  }
}

function isPremium() {
  const cached = getCachedEntitlements();
  return cached.tier === "premium";
}

function setTier(tier) {
  try {
    wx.setStorageSync(TIER_KEY, tier === "premium" ? "premium" : "free");
  } catch (error) {
    // 小程序存储失败时保持免费层
  }
}

function getCachedEntitlements() {
  try {
    const cached = wx.getStorageSync(ENTITLEMENTS_KEY);
    if (cached && cached.tier) return cached;
  } catch (error) {}
  return buildLocalEntitlements(getLocalTier());
}

function cacheEntitlements(entitlements) {
  try {
    wx.setStorageSync(ENTITLEMENTS_KEY, entitlements);
  } catch (error) {}
}

function clearCachedEntitlements() {
  try {
    wx.removeStorageSync(ENTITLEMENTS_KEY);
  } catch (error) {}
}

function buildLocalEntitlements(tier) {
  const premium = tier === "premium";
  return {
    tier: premium ? "premium" : "free",
    canSeeDeepExplanation: premium,
    canSeeAllReplacements: premium,
    canSaveUnlimitedLineups: premium,
    matchupLimit: premium ? 12 : 2
  };
}

function getEntitlements() {
  return getCachedEntitlements();
}

// Sync entitlements from server (call on app launch or login)
function syncEntitlements() {
  const api = require("../services/api");
  if (!api.isRemoteMode() || !api.isLoggedIn()) {
    clearCachedEntitlements();
    return Promise.resolve(getEntitlements());
  }
  return api
    .requestRemote("/api/v1/auth/entitlements")
    .then((data) => {
      const entitlements = data.entitlements || buildLocalEntitlements("free");
      cacheEntitlements(entitlements);
      return entitlements;
    })
    .catch(() => {
      return getCachedEntitlements();
    });
}

module.exports = {
  getTier: getLocalTier,
  isPremium,
  setTier,
  getEntitlements,
  syncEntitlements,
  cacheEntitlements,
  clearCachedEntitlements
};
