const KEY = 'phonics-diagnostics-v1';
function createLogger(storage) {
  let entries = [], loaded = false, persisted = true;
  function clean(value) {
    const seen = new Set();
    let text;
    try { text = JSON.stringify(value, (key, v) => {
      if (/token|cookie|authorization|password|secret/i.test(key)) return '[redacted]';
      if (typeof v === 'string') return v.replace(/https?:\/\/[^\s"'<>]+/g, url => url.split(/[?#]/)[0].replace(/^(https?:\/\/)[^/@]*@/, '$1[redacted]@'));
      if (v instanceof Error) return { message: v.message, stack: v.stack };
      if (v && typeof v === 'object') { if (seen.has(v)) return '[circular]'; seen.add(v); }
      return v;
    }); } catch (_) { text = '[unserializable]'; }
    return String(text || '').slice(0, 1600);
  }
  function init() {
    if (loaded) return; loaded = true;
    try { const saved = storage.get(); if (Array.isArray(saved)) entries = saved.slice(-100).filter(e => e && typeof e.time === 'string' && typeof e.event === 'string' && typeof e.detail === 'string').map(e => ({time:e.time.slice(0,30),event:e.event.slice(0,80),detail:clean(e.detail)})); } catch (_) {}
  }
  function save() { try { storage.set(entries); persisted = true; } catch (_) { persisted = false; } }
  return {
    record(event, detail) { try { init(); entries.push({time:new Date().toISOString(),event:String(event).slice(0,80),detail:clean(detail)}); entries = entries.slice(-100); save(); } catch (_) {} },
    list() { init(); return entries.map(e => ({...e})); },
    status() { return persisted; },
    clear() { init(); entries = []; save(); },
    export() { init(); return 'Phonics Planet diagnostics v1\n' + entries.map(e => `${e.time} ${e.event}\n${e.detail}`).join('\n\n'); }
  };
}
const logger = createLogger({get:()=>wx.getStorageSync(KEY),set:entries=>wx.setStorageSync(KEY,entries)});
module.exports = { ...logger, createLogger };
