(function initHoopRushUtils(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function hash01(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function hashString01(value, salt = 0) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash01((hash >>> 0) + salt);
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const size = clean.length === 3 ? 1 : 2;
    const channels = [];
    for (let i = 0; i < 3; i++) {
      const part = clean.slice(i * size, i * size + size);
      const value = parseInt(size === 1 ? `${part}${part}` : part, 16);
      channels.push(Number.isNaN(value) ? 255 : value);
    }
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  HoopRushModules.utils = {
    clamp,
    hash01,
    hashString01,
    hexToRgba,
  };
})(window);
