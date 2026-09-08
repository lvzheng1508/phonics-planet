const content = require('../../services/content-service');
const audio = require('../../services/audio-service');
Page({ data: { item: null, spellings: '', contrasts: [], audioIds: [] }, onLoad({id}) { const item = content.phoneme(id); if (item) this.setData({item, spellings:item.commonSpellings.join(' · '), contrasts:item.contrast.map(x => content.phoneme(x)).filter(Boolean), audioIds:[item.audioId]}); }, onHide() { audio.stop(); }, onUnload() { audio.stop(); } });
