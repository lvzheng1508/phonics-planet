const data = require('../miniprogram/data/generated');
const content = require('../miniprogram/services/content-service').createContentService(data);
const words = data.words;
const ready = words.filter(w => w.enrichmentStatus === 'verified');
const report = { words: words.length, reviewedPronunciations: ready.length,
  playableWords: words.filter(w => content.audioReady(w.audioId)).length,
  playablePhonemes: data.phonemes.filter(p => content.audioReady(p.audioId)).length,
  completeLearningWords: ready.filter(w => content.audioReady(w.audioId) && w.phonemes.every(id => content.audioReady(content.phoneme(id).audioId))).length,
  curriculumStatus: data.curriculums.map(c => ({ id: c.id, status: c.reviewStatus })) };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--release') && (report.playablePhonemes !== 44 || report.completeLearningWords !== words.length || report.curriculumStatus.some(c => c.status !== 'verified'))) {
  console.error('Content is not ready for release; structure/build success does not constitute teaching review.'); process.exitCode = 1;
}
