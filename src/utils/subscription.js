import { getStorage, setStorage, removeStorage } from "./storage";

const TIER_KEY = "subscriptionTier";
const ENTITLEMENTS_KEY = "cachedEntitlements";

function getLocalTier() {
  try { return getStorage(TIER_KEY) || "free"; } catch { return "free"; }
}

export function isPremium() {
  return getCachedEntitlements().tier === "premium";
}

export function setTier(tier) {
  try { setStorage(TIER_KEY, tier === "premium" ? "premium" : "free"); } catch {}
}

function getCachedEntitlements() {
  try {
    const cached = getStorage(ENTITLEMENTS_KEY);
    if (cached && cached.tier) return cached;
  } catch {}
  return buildLocalEntitlements(getLocalTier());
}

function cacheEntitlements(entitlements) {
  try { setStorage(ENTITLEMENTS_KEY, entitlements); } catch {}
}

export function clearCachedEntitlements() {
  try { removeStorage(ENTITLEMENTS_KEY); } catch {}
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

export function getEntitlements() {
  return getCachedEntitlements();
}

export function syncEntitlements() {
  // Lazy import to avoid circular dependency with api.js
  const api = require("../services/api");
  if (!api.isRemoteMode() || !api.isLoggedIn()) {
    clearCachedEntitlements();
    return Promise.resolve(getEntitlements());
  }
  return api.requestRemote("/api/v1/auth/entitlements")
    .then((data) => {
      const entitlements = data.entitlements || buildLocalEntitlements("free");
      cacheEntitlements(entitlements);
      return entitlements;
    })
    .catch(() => getCachedEntitlements());
}

export default { getTier: getLocalTier, isPremium, setTier, getEntitlements, syncEntitlements, cacheEntitlements, clearCachedEntitlements };
