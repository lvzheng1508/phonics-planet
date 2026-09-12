const log = require('../../services/diagnostic-log');
Page({
  data: { entries: [], persisted: true },
  onShow() { this.refresh(); },
  refresh() { this.setData({ entries: log.list().reverse(), persisted: log.status() }); },
  copy() { wx.setClipboardData({data:log.export(),fail:()=>wx.showToast({title:'复制失败，请重试',icon:'none'})}); },
  copyEntry(event) {
    const entry = this.data.entries[Number(event.currentTarget.dataset.index)];
    if (!entry || entry.event !== 'resource.error') return;
    wx.setClipboardData({data:'Phonics Planet download failure\n' + entry.time + ' ' + entry.event + '\n' + entry.detail,
      fail:()=>wx.showToast({title:'复制失败，请重试',icon:'none'})});
  },
  clear() { log.clear(); this.refresh(); }
});
