// Resource addresses and cache policy are independent of pages and audio playback.
const log = require('./diagnostic-log');
function createUrlProvider(baseUrl) {
  const base = String(baseUrl).replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) throw Error('资源地址必须使用 HTTPS');
  return asset => {
    const path = String(asset.src || '').replace(/^resource:\/\//, '');
    if (!String(asset.src).startsWith('resource://') || !path || path.split('/').some(x => !/^[a-zA-Z0-9_.-]+$/.test(x) || x === '.' || x === '..')) throw Error('资源路径无效');
    return base + '/' + path;
  };
}

function isResourceDescriptor(a) {
  return !!(a && /^[a-f0-9]{40}$/.test(a.sha1) && /^(mp3|wav|jpg|png)$/.test(a.extension) && Number.isSafeInteger(a.bytes) && a.bytes > 0);
}
function createResourceCache(adapter, provider, { maxFiles = 100, maxBytes = 8 * 1024 * 1024 } = {}) {
  let entries = [], initialized = false, tail = Promise.resolve();
  let downloads = 0, hits = 0, requestCounter = 0;
  const pins = new Map();
  const persist = () => adapter.writeIndex(entries);
  const keyOf = a => a.sha1 + '.' + a.extension;
  const valid = isResourceDescriptor;
  const bytes = () => entries.reduce((sum, e) => sum + e.bytes, 0);
  async function init() {
    if (initialized) return;
    let saved;
    try { saved = adapter.readIndex(); } catch (_) { saved = []; }
    entries = Array.isArray(saved) ? saved.filter(e => valid(e) && typeof e.path === 'string' && e.key === keyOf(e)) : [];
    // A crash between saving a file and saving its index must not leak disk space.
    for (const path of adapter.list()) if (!entries.some(e => e.path === path)) await adapter.remove(path);
    initialized = true;
  }
  function lease(entry, cached) {
    pins.set(entry.key, (pins.get(entry.key) || 0) + 1);
    let released = false;
    return { path: entry.path, cached, release() {
      if (released) return; released = true;
      const count = (pins.get(entry.key) || 1) - 1;
      if (count) pins.set(entry.key, count); else pins.delete(entry.key);
    } };
  }
  async function acquireOne(asset, options = {}) {
    if (!asset || !String(asset.src).startsWith('resource://')) return { path: asset && asset.src, cached: false, release() {} };
    if (!valid(asset)) throw Error('资源缺少版本校验信息');
    if (asset.bytes > maxBytes || maxFiles < 1) throw Error('资源超过缓存容量');
    await init();
    const key = keyOf(asset);
    const existing = entries.find(e => e.key === key);
    if (existing) {
      try {
        const info = await adapter.info(existing.path);
        if (info.size === asset.bytes && info.digest === asset.sha1) { hits++; log.record('cache.hit', {id:asset.id,key}); return lease(existing, true); }
      } catch (_) {}
      if (pins.has(key)) throw Error('资源使用中，请停止播放后重试');
      await adapter.remove(existing.path);
      entries = entries.filter(e => e !== existing); persist();
    }
    if (options.download === false) throw Object.assign(Error('尚未下载音频，请先下载音频包'), {code:'AUDIO_NOT_INSTALLED'});
    let temporary, saved;
    // This object belongs to one request; the adapter enriches it even when
    // download succeeds but validation or saving subsequently fails.
    const diagnostic = {
      requestId: 'resource-' + Date.now() + '-' + (++requestCounter),
      id: asset.id, word: asset.text || null, key, requestUrl: null, stage: 'prepare',
      statusCode: null, contentType: null, contentLength: null, location: null,
      responseSummary: null, summaryTruncated: false, summaryReadError: null,
      expectedBytes: asset.bytes, actualBytes: null, expectedSha1: asset.sha1,
      actualSha1: null, nativeErrorCode: null
    };
    try {
      downloads++;
      diagnostic.requestUrl = provider(asset);
      diagnostic.stage = 'download';
      temporary = await adapter.download(diagnostic.requestUrl, diagnostic);
      diagnostic.stage = 'validate';
      const info = await adapter.info(temporary);
      diagnostic.actualBytes = info.size; diagnostic.actualSha1 = info.digest;
      log.record('resource.validation', {id:asset.id,key,expectedBytes:asset.bytes,actualBytes:info.size,expectedSha1:asset.sha1,actualSha1:info.digest});
      if (info.size !== asset.bytes || info.digest !== asset.sha1) throw Error('资源校验失败，请检查下载链接');
      diagnostic.stage = 'cache-evict';
      while (entries.length >= maxFiles || bytes() + asset.bytes > maxBytes) {
        const oldest = entries.find(e => !pins.has(e.key));
        if (!oldest) throw Error('缓存资源使用中，请稍后重试');
        await adapter.remove(oldest.path);
        entries = entries.filter(e => e !== oldest); persist();
      }
      diagnostic.stage = 'cache-save';
      saved = await adapter.save(temporary, key);
      log.record('cache.saved', {id:asset.id,key,path:saved});
      // wx.saveFile consumes the temporary download path. It must not be unlinked again.
      temporary = undefined;
      const entry = { key, sha1: asset.sha1, extension: asset.extension, bytes: asset.bytes, path: saved };
      entries.push(entry);
      diagnostic.stage = 'cache-index';
      try { persist(); } catch (error) {
        entries = entries.filter(e => e !== entry); await adapter.remove(saved); throw error;
      }
      return lease(entry, false);
    } catch (error) {
      log.record('resource.error', { ...diagnostic, error: {code:error.code || null,message:String(error.message || error).slice(0,500)} });
      throw error;
    } finally {
      if (temporary && temporary !== saved) {
        // Cleanup of a platform-managed temporary file must preserve the original failure.
        // Persistent cache eviction errors still propagate from their explicit remove calls.
        try { await adapter.remove(temporary); } catch (error) { log.record('cleanup.error', {temporary,error}); }
      }
    }
  }
  // Serialize admission/eviction. Duplicate concurrent callers become cache hits.
  function enqueue(operation) {
    const job = tail.then(operation);
    tail = job.catch(() => {});
    return job;
  }
  return {
    acquire: (asset, options) => enqueue(() => acquireOne(asset, options)),
    stats: () => ({ count: entries.length, bytes: bytes(), downloads, hits, maxFiles, maxBytes, entries: entries.map(e => ({ ...e })) }),
    inspect: () => enqueue(async () => { await init(); return { count: entries.length, bytes: bytes(), downloads, hits, maxFiles, maxBytes }; }),
    clear: () => enqueue(async () => {
      await init();
      if (pins.size) throw Error('请先停止播放再清除缓存');
      for (const e of entries) await adapter.remove(e.path);
      entries = []; persist();
    })
  };
}
let singleton;
function shared() {
  if (!singleton) {
    const { createWxResourceAdapter } = require('./wx-resource-adapter');
    const settings = require('../resource-config');
    singleton = createResourceCache(createWxResourceAdapter(wx, 'audio-v1'), createUrlProvider(settings.baseUrl), settings.audioCache);
  }
  return singleton;
}
module.exports = { createResourceCache, createUrlProvider, isResourceDescriptor,
  async acquire(a) {
    if (!String(a.src).startsWith('resource://')) return {path:a.src,release(){}};
    const installed = await require('./audio-bundle-service').acquire(a);
    return installed || shared().acquire(a, {download:false});
  },
  inspect: () => shared().inspect(),
  async clear() { await require('./audio-bundle-service').clear(); await shared().clear(); }
};
