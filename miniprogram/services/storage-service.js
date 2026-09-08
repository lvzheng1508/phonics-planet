const KEY = 'phonics-planet:collections:v1';
function createStorageService(api) {
  return {
    favorites() { try { const value = api.getStorageSync(KEY); return Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))] : []; } catch (_) { return []; } },
    toggle(id) { if (typeof id !== 'string' || !id) throw new Error('无效单词'); const ids = this.favorites(); const exists = ids.includes(id); api.setStorageSync(KEY, exists ? ids.filter(x => x !== id) : ids.concat(id)); return !exists; }
  };
}
module.exports = { createStorageService, favorites: () => createStorageService(wx).favorites(), toggle: id => createStorageService(wx).toggle(id) };
