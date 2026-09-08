const content = require('../../services/content-service');
Page({ data: { unit: null, entries: [] }, onLoad({curriculumId,unitId}) { const unit = content.unit(curriculumId,unitId); if (unit) this.setData({unit,entries:unit.entries.map(x => ({...x,word:content.word(x.wordId).word}))}); } });
