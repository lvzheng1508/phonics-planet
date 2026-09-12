const resources = require('../../services/resource-service');
const audio = require('../../services/audio-service');
const samples = require('../../data/generated').resourceSamples;
const content = require('../../services/content-service');
function catalog() {
  return samples.map(a => ({...a, note: a.changes || '真人参考录音，仅用于技术测试。'})).concat(
    require('../../data/generated').audio.filter(a => a.src && (a.src.startsWith('resource://') || a.src.startsWith('/assets/audio/'))).map(a => ({...a,
      bundled: a.src.startsWith('/assets/audio/'),
      label: a.text || (content.word(a.id) || {}).word || a.id,
      note: a.status === 'synthetic-preview' ? 'AI 合成试听 · 待发音核对' : '仅用于技术测试；审核状态：' + a.status
    })));
}
Page({
  data: { items: samples, message: '', state: 'idle', progress: 0, stats: {}, busy: false },
  onLoad(options = {}) {
    this.hidden = false;
    this.assets = catalog();
    const selected = this.assets.find(a => a.id === options.id);
    this.setData({items: selected ? [{...selected, selected:true}, ...this.assets.filter(a => a.id !== selected.id)] : this.assets,
      message: options.id && !selected ? '未找到该音频，请从下方选择资源。' : selected ? '已定位音频，可单独检查或试听，随后复制诊断日志。' : ''});
    this.player = audio.createAudioService(() => wx.createInnerAudioContext(), id => this.assets.find(x => x.id === id), 20000, {
      acquire: asset => resources.acquire(asset),
      // Explicit technical audition; this manifest never enters learning pages.
      isPlayable: asset => !!asset && this.assets.includes(asset) && !!asset.source && !!asset.license
    });
    this.off = this.player.subscribe(s => { if (!this.hidden) this.setData({ state: s.status, progress: Math.round(s.progress * 100) }); });
  },
  onShow() { this.hidden = false; this.refresh(); },
  async refresh() {
    try { const stats = await resources.inspect(); if (!this.hidden) this.setData({ stats }); }
    catch (error) { if (!this.hidden) this.setData({ message: error.message }); }
  },
  async download(event) {
    const asset = this.assets.find(x => x.id === event.currentTarget.dataset.id);
    if (!asset) { this.setData({ message: '找不到测试资源' }); return; }
    if (this.data.busy) return;
    this.setData({ busy: true, message: '正在取得资源…' });
    try {
      const lease = await resources.acquire(asset);
      const message = asset.bundled ? '使用随小程序打包的音频，无需下载' : lease.cached ? '命中本地缓存，没有网络下载' : '下载完成，大小及 SHA-1 校验通过，已保存本地';
      lease.release();
      if (!this.hidden) this.setData({ message });
    } catch (error) { if (!this.hidden) this.setData({ message: error.message }); }
    finally { this.setData({ busy: false }); if (!this.hidden) this.refresh(); }
  },
  async play(event) {
    audio.stop();
    this.setData({ message: '技术试听：尚未作为英式教学录音审核' });
    try {
      const finished = await this.player.play([event.currentTarget.dataset.id], { owner: 'resource-test' });
      if (finished && !this.hidden) this.setData({ message: '播放完成（收到微信 onEnded 事件）' });
    } catch (error) { if (!this.hidden) this.setData({ message: error.message }); }
    finally { if (!this.hidden) this.refresh(); }
  },
  stop() { if (this.player) this.player.stop(); },
  async clear() {
    this.stop();
    try { await resources.clear(); if (!this.hidden) this.setData({ message: '音频缓存已清除；下载计数为本次运行累计' }); }
    catch (error) { if (!this.hidden) this.setData({ message: error.message }); }
    if (!this.hidden) this.refresh();
  },
  copySource(event) { wx.setClipboardData({ data: event.currentTarget.dataset.source }); },
  onHide() { this.stop(); this.hidden = true; },
  onUnload() { this.onHide(); if (this.off) this.off(); }
});
