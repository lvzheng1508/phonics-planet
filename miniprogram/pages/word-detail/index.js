const content = require('../../services/content-service');
const storage = require('../../services/storage-service');
const audio = require('../../services/audio-service');
const { route, toast } = require('../../utils/view');
Page({
 data: { item: null, favorite: false, audioIds: [], sequence: [], activeIndex: -1, related: [] },
 onLoad(options) {
   const item = content.detail(options.id, options); if (!item) return;
   item.sounds = item.sounds.map(s => ({ ...s, url: route('phoneme-detail', { id: s.id }) }));
   this.setData({ item, audioIds: item.audioId ? [item.audioId] : [], sequence: item.sequence });
   try { storage.recordVisit(item.id); } catch(error) { toast(error); }
 },
 onShow() {
   if (!this.data.item) return;
   this.setData({ favorite: storage.favorites().includes(this.data.item.id) });
   this.off = audio.subscribe(state => this.setData({ activeIndex: state.owner === 'word-sequence' ? state.index : -1 }));
 },
 toggle() { if (!this.data.item) return; try { this.setData({ favorite: storage.toggle(this.data.item.id) }); } catch(error) { toast(error); } },
 onHide() { audio.stop(); if (this.off) this.off(); this.off = null; },
 onUnload() { this.onHide(); }
});
