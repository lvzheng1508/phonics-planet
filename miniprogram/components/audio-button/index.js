const audio = require('../../services/audio-service');
Component({ properties: { ids: { type: Array, value: [] }, label: { type: String, value: '听发音' } }, methods: { async play() { try { await audio.play(this.data.ids); } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); } } } });
