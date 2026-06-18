function hashSeed(seed) {
  const text = String(seed === undefined || seed === null ? "sgzzlb" : seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed);
  return function nextRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random, min, max) {
  return min + (max - min) * random();
}

function pickRandom(random, items) {
  if (!items.length) return null;
  return items[Math.floor(random() * items.length)];
}

module.exports = {
  createRandom,
  randomBetween,
  pickRandom
};
