const characterCache = new Map();
const clientSubscriptions = new Map();
const CACHE_COOLDOWN_MS = 5000; // 5 segundos

module.exports = {
  characterCache,
  clientSubscriptions,
  CACHE_COOLDOWN_MS
};