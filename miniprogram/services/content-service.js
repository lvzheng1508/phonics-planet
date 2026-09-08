const data = require('../data/generated');
module.exports = {
  phonemes: () => data.phonemes,
  phoneme: id => data.phonemes.find(x => x.id === id),
  word: id => data.words.find(x => x.id === id),
  curriculums: () => data.curriculums,
  curriculum: id => data.curriculums.find(x => x.id === id),
  unit(curriculumId, unitId) { const c = this.curriculum(curriculumId); return c && c.units.find(x => x.id === unitId); },
  audio: id => data.audio.find(x => x.id === id)
};
