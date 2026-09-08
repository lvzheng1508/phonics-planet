const content = require('./content-service');
function createAudioService(createContext, resolve, timeoutMs = 20000) {
  let active = null;
  function stop() { if (active) active.finish(false); }
  async function play(ids) {
    stop();
    if (!Array.isArray(ids) || !ids.length) throw new Error('发音正在准备中');
    const assets = ids.map(resolve);
    if (assets.some(x => !x || x.status !== 'verified' || !x.src || !x.source || !x.license || !x.reviewer)) throw new Error('发音正在准备中');
    return new Promise((resolvePlay, reject) => {
      let ctx, timer, index = 0, done = false;
      const session = { finish(result, error) {
        if (done) return; done = true; clearTimeout(timer);
        if (active === session) active = null;
        if (ctx) { ctx.stop(); ctx.destroy(); }
        if (error) reject(error); else resolvePlay(result);
      } };
      active = session;
      function next() {
        if (done) return;
        clearTimeout(timer);
        if (index === assets.length) return session.finish(true);
        timer = setTimeout(() => session.finish(false, new Error('音频加载超时，请稍后再试')), timeoutMs);
        try { ctx.src = assets[index++].src; ctx.play(); } catch (_) { session.finish(false, new Error('暂时无法播放')); }
      }
      try { ctx = createContext(); ctx.onEnded(next); ctx.onError(() => session.finish(false, new Error('暂时无法播放'))); next(); }
      catch (_) { session.finish(false, new Error('暂时无法播放')); }
    });
  }
  return { play, stop };
}
const service = createAudioService(() => wx.createInnerAudioContext(), id => content.audio(id));
module.exports = { ...service, createAudioService };
