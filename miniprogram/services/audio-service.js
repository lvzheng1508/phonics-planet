const content = require('./content-service');
const config = require('../config');
const log = require('./diagnostic-log');
const { isPlayableAsset } = require('./audio-policy');
function createAudioService(createContext, resolve, timeoutMs = 20000, options = {}) {
  let active = null;
  let current = { status: 'idle', owner: '', index: -1, audioId: '', progress: 0, currentTime: 0, duration: 0 };
  const listeners = new Set();
  function publish(state) { current = state; for (const listener of listeners) { try { listener({ ...state }); } catch (_) {} } }
  function stop(owner) { if (active && (!owner || active.owner === owner)) active.finish(false); }
  function cleanup(ctx) { if (!ctx) return; try { ctx.stop(); } catch (_) {} try { ctx.destroy(); } catch (_) {} }
  async function play(ids, { owner = 'default' } = {}) {
    stop();
    if (!Array.isArray(ids) || !ids.length) throw Error('发音正在准备中');
    const assets = ids.map(resolve);
    if (assets.some(x => !(options.isPlayable || (asset => isPlayableAsset(asset, options.allowPreview === true, options.allowSyntheticWords === true)))(x))) throw Error('发音正在准备中');
    return new Promise((resolvePlay, reject) => {
      let ctx, timer, lease, index = -1, done = false, generation = 0;
      function release() { if (lease) { lease.release(); lease = null; } }
      const session = { owner, finish(result, error) {
        if (done) return; done = true; generation++; clearTimeout(timer); cleanup(ctx); release();
        if (error) log.record('audio.error', {owner,audioId:ids[index],error});
        if (active === session) { active = null; publish({ status: error ? 'error' : 'idle', owner: '', index: -1, audioId: '', progress: 0, currentTime: 0, duration: 0, message: error ? error.message : '' }); }
        if (error) reject(error); else resolvePlay(result);
      } };
      active = session;
      async function next() {
        if (done) return;
        generation++; const step = generation;
        clearTimeout(timer); cleanup(ctx); release(); ctx = null; index++;
        if (index >= assets.length) return session.finish(true);
        const state = { owner, index, audioId: ids[index], progress: 0, currentTime: 0, duration: 0 };
        publish({ ...state, status: 'loading' });
        timer = setTimeout(() => session.finish(false, Error('音频加载超时，请稍后再试')), timeoutMs);
        try {
          let src = assets[index].src;
          if (options.acquire) {
            const acquired = await options.acquire(assets[index]);
            if (done || generation !== step) { acquired.release(); return; }
            lease = acquired; src = acquired.path;
          }
          ctx = createContext();
          ctx.onEnded(() => { if (!done && generation === step) { log.record('audio.ended', {audioId:ids[index]}); next(); } });
          ctx.onError(error => { if (!done && generation === step) { log.record('audio.nativeError', {audioId:ids[index],error}); session.finish(false, Error('暂时无法播放，请重试')); } });
          if (ctx.onPlay) ctx.onPlay(() => { if (!done && generation === step) publish({ ...state, status: 'playing' }); });
          const clip = ctx;
          if (ctx.onTimeUpdate) ctx.onTimeUpdate(() => {
            if (done || generation !== step) return;
            const duration = Number(clip.duration), time = Number(clip.currentTime);
            if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return;
            publish({ ...state, status: 'playing', currentTime: Math.max(0, time), duration, progress: Math.max(0, Math.min(1, time / duration)) });
          });
          ctx.src = src; ctx.play();
        } catch (error) { if (!done && generation === step) session.finish(false, Error(error.message || '暂时无法播放，请重试')); }
      }
      next();
    });
  }
  return { play, stop, state: () => ({ ...current }), subscribe(listener) { listeners.add(listener); listener({ ...current }); return () => listeners.delete(listener); } };
}
const service = createAudioService(() => wx.createInnerAudioContext(), id => content.audio(id), 20000, { allowPreview: config.allowPreviewAudio, allowSyntheticWords: config.allowSyntheticWordAudio, acquire: asset => require('./resource-service').acquire(asset) });
module.exports = { ...service, createAudioService };
