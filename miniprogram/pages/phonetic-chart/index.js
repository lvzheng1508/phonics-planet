const content = require('../../services/content-service');
Page({ data: { groups: [] }, onLoad() { const all = content.phonemes(); this.setData({ groups: [['short','短元音'],['long','长元音'],['diphthong','双元音'],['consonant','辅音']].map(([id,name]) => ({ id, name, items: all.filter(p => id === 'consonant' ? p.category === id : p.subCategory === id) })) }); } });
