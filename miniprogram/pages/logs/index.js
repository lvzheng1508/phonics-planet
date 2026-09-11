const log = require('../../services/diagnostic-log');
Page({
  data: { entries: [], persisted: true },
  onShow() { this.refresh(); },
  refresh() { this.setData({ entries: log.list().reverse(), persisted: log.status() }); },
  copy() { wx.setClipboardData({data:log.export(),fail:()=>wx.showToast({title:'复制失败，请重试',icon:'none'})}); },
  clear() { log.clear(); this.refresh(); }
});
