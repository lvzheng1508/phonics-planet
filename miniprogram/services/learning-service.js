const content = require('./content-service');
const storage = require('./storage-service');
function createLearningService(c, s) {
  function reviewQueue() {
    const state = s.snapshot(); const day = s.todayKey();
    return state.favorites.filter(id => !state.reviews[id] || state.reviews[id].dueAt <= day)
      .map(c.word).filter(Boolean).sort((a, b) => (state.reviews[a.id]?.dueAt || '').localeCompare(state.reviews[b.id]?.dueAt || ''));
  }
  function today() {
    const state = s.snapshot(); const todayKey = s.todayKey();
    const d = state.days[todayKey] || { visitedWordIds: [], reviewedWordIds: [], answers: [] };
    const book = c.curriculum(state.selection.curriculumId) || c.curriculums()[0];
    const unit = book && (c.unit(book.id, state.selection.unitId) || book.units[0]);
    const candidates = unit ? c.unitWords(book.id, unit.id) : [];
    return { date: todayKey, visitedCount: d.visitedWordIds.length, reviewedCount: d.reviewedWordIds.length,
      answeredCount: d.answers.length, correctCount: d.answers.filter(a => a.correct).length,
      favoriteCount: state.favorites.map(c.word).filter(Boolean).length, dueCount: reviewQueue().length,
      newWords: candidates.filter(w => !d.visitedWordIds.includes(w.id)).slice(0, 3), book: book || null, unit: unit || null,
      recentWords: state.recent.map(x => c.word(x.wordId)).filter(Boolean).slice(0, 4) };
  }
  return { today, reviewQueue };
}
module.exports = { ...createLearningService(content, storage), createLearningService };
