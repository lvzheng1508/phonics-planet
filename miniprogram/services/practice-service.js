const content = require('./content-service');
function createPracticeService(c) {
  function createSession(type, wordIds = [], seed = Date.now()) {
    if (!['listen-word', 'word-ipa', 'same-sound'].includes(type)) return [];
    let state = (Number(seed) || 1) >>> 0;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const shuffle = items => { const result = items.slice(); for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; };
    const pool = c.words().filter(w => w.enrichmentStatus === 'verified' && w.ipa && (!w.pronunciations || w.pronunciations.length < 2));
    const targets = pool.filter(w => !wordIds.length || wordIds.includes(w.id));
    const vowel = w => { const vs = w.phonemes.map(c.phoneme).filter(p => p && p.category === 'vowel'); return vs.length === 1 ? vs[0].id : null; };
    const questions = [];
    for (const word of shuffle(targets)) {
      if (type === 'listen-word' && !c.audioReady(word.audioId)) continue;
      let answer = word, distractors = pool.filter(w => w.id !== word.id && w.word !== word.word && w.ipa !== word.ipa);
      if (type === 'same-sound') {
        const sound = vowel(word); if (!sound) continue;
        answer = shuffle(pool.filter(w => w.id !== word.id && w.word !== word.word && vowel(w) === sound))[0]; if (!answer) continue;
        distractors = pool.filter(w => vowel(w) && vowel(w) !== sound);
      }
      const label = w => type === 'word-ipa' ? '/' + w.ipa + '/' : w.word;
      const used = new Set([label(answer)]);
      const choices = shuffle(distractors).filter(w => { const l = label(w); if (used.has(l)) return false; used.add(l); return true; }).slice(0, 2);
      if (choices.length !== 2) continue;
      const options = shuffle([answer, ...choices]).map(w => ({ id: w.id, label: label(w) }));
      questions.push({ id: type + ':' + word.id, type, wordId: word.id, word: word.word,
        prompt: type === 'listen-word' ? '听一听，选出这个单词' : type === 'word-ipa' ? '选出单词的音标' : '哪个词的元音和它相同？',
        audioIds: type === 'listen-word' ? [word.audioId] : [], options, answerId: answer.id, answerLabel: label(answer), explanation: answer.word + ' /' + answer.ipa + '/' });
      if (questions.length === 5) break;
    }
    return questions;
  } return { createSession };
}
module.exports = { ...createPracticeService(content), createPracticeService };
