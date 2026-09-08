const content = require('../../services/content-service');
const storage = require('../../services/storage-service');
Page({ data: { words:[] }, onShow() { this.setData({words:storage.favorites().map(x => content.word(x)).filter(Boolean)}); } });
