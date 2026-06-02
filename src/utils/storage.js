export function getStorage(key) {
  try {
    return uni.getStorageSync(key) || null;
  } catch (e) {
    return null;
  }
}

export function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value);
  } catch (e) {
    console.error("Storage set failed:", e);
  }
}

export function removeStorage(key) {
  try {
    uni.removeStorageSync(key);
  } catch (e) {
    console.error("Storage remove failed:", e);
  }
}
