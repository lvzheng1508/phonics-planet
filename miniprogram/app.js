const audio = require('./services/audio-service');
const log = require('./services/diagnostic-log');
App({
  onLaunch() {
    try { const info = wx.getSystemInfoSync(); log.record('app.launch', {platform:info.platform,system:info.system,model:info.model,version:info.version,SDKVersion:info.SDKVersion}); } catch (_) {}
  },
  onError(error) { log.record('app.error', error); },
  onUnhandledRejection(event) { log.record('app.unhandledRejection', event.reason); },
  onShow() { require('./services/unit-audio-loader').foreground(true); },
  onHide() { require('./services/unit-audio-loader').foreground(false); audio.stop(); }
});
