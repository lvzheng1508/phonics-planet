const KEY = 'phonics-planet:user:v2';
const LEGACY = 'phonics-planet:collections:v1';
const SEARCH_KEY = 'phonics-planet:search:v1';
const {normalizeQuery} = require('../utils/search-text');
const data = require('../data/generated');
const strings = values => Array.isArray(values) ? [...new Set(values.filter(x => typeof x === 'string' && x))] : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
function createStorageService(api, { words = data.words, now = () => new Date() } = {}) {
  function read(key, strict) { try { return api.getStorageSync(key); } catch (_) { if (strict) throw Error('读取学习记录失败，请稍后重试'); return undefined; } }
  function snapshot(strict = false) {
    const raw = object(read(KEY, strict));
    const customWords = (Array.isArray(raw.customWords) ? raw.customWords : []).filter(w => w && typeof w.id === 'string' && w.id.startsWith('custom_') && typeof w.word === 'string' && Array.isArray(w.meanings)).map(w => ({ ...w, ipa: null, phonemes: [], segments: [], syllables: [], audioId: null, enrichmentStatus: 'pending' }));
    const reviews = {};
    for (const [id, r] of Object.entries(object(raw.reviews))) if (r && Number.isInteger(r.box) && r.box >= 0 && r.box <= 4 && validDate(r.dueAt)) reviews[id] = { ...r };
    const days = {};
    for (const [key, value] of Object.entries(object(raw.days))) {
      if (!validDate(key)) continue;
      const d = object(value);
      days[key] = { visitedWordIds: strings(d.visitedWordIds), reviewedWordIds: strings(d.reviewedWordIds), answers: (Array.isArray(d.answers) ? d.answers : []).filter(a => a && typeof a.questionId === 'string' && typeof a.correct === 'boolean') };
    }
    return { version: 2, favorites: strings(raw.version === 2 ? raw.favorites : read(LEGACY, strict)), customWords, reviews, days,
      recent: (Array.isArray(raw.recent) ? raw.recent : []).filter(x => x && typeof x.wordId === 'string' && Number.isFinite(x.at)).slice(0, 20),
      selection: object(raw.selection), tokens: strings(raw.tokens).slice(-500) };
  }
  function mutate(fn) {
    const state = snapshot(true); const result = fn(state);
    const keep = Object.keys(state.days).sort().slice(-31);
    state.days = Object.fromEntries(keep.map(k => [k, state.days[k]])); state.tokens = state.tokens.slice(-500);
    api.setStorageSync(KEY, state);
    return result;
  }
  function day(state) {
    const key = dateKey(now());
    if (!state.days[key]) state.days[key] = { visitedWordIds: [], reviewedWordIds: [], answers: [] };
    return state.days[key];
  }
  function requireWord(id, state) { if (!words.concat(state.customWords).some(w => w.id === id)) throw Error('没有找到这个单词'); }
  function searchHistory(strict = false) {
    const value = read(SEARCH_KEY, strict);
    return strings((Array.isArray(value) ? value : []).filter(x => typeof x === 'string' && x.length <= 80).map(normalizeQuery)).slice(0, 8);
  }
  return {
    searchHistory,
    rememberSearch(value) {
      const query = normalizeQuery(value).slice(0, 80); if (!query) return;
      const history = searchHistory(true);
      api.setStorageSync(SEARCH_KEY, [query].concat(history.filter(x => x !== query)).slice(0, 8));
    },
    clearSearchHistory() { api.setStorageSync(SEARCH_KEY, []); },
    snapshot, todayKey: () => dateKey(now()), favorites: () => snapshot().favorites,
    toggle(id) {
      if (typeof id !== 'string' || !id) throw Error('无效单词');
      return mutate(s => { const exists = s.favorites.includes(id); s.favorites = exists ? s.favorites.filter(x => x !== id) : s.favorites.concat(id); return !exists; });
    },
    addWord(text, meaning) {
      const word = String(text || '').trim().replace(/\s+/g, ' ').toLowerCase(); const gloss = String(meaning || '').trim();
      if (!/^[a-z]+(?:[ '\-][a-z]+)*$/.test(word) || word.length > 80) throw Error('请输入英文单词或短语');
      if (!gloss || gloss.length > 120) throw Error('请填写 1–120 字的释义');
      return mutate(s => {
        let item = words.concat(s.customWords).find(w => w.word.toLowerCase() === word);
        if (!item) {
          item = { id: 'custom_' + encodeURIComponent(word), word, meanings: [gloss], accent: 'en-GB', ipa: null, syllables: [], phonemes: [], segments: [], audioId: null, reviewStatus: 'pending', enrichmentStatus: 'pending', sourceIds: ['user-input'] };
          s.customWords.push(item);
        }
        if (!s.favorites.includes(item.id)) s.favorites.push(item.id);
        return item;
      });
    },
    setSelection(curriculumId, unitId) { mutate(s => { s.selection = { curriculumId, unitId }; }); },
    recordVisit(id) { mutate(s => { requireWord(id, s); const d = day(s); d.visitedWordIds = strings(d.visitedWordIds.concat(id)); s.recent = [{ wordId: id, at: now().getTime() }].concat(s.recent.filter(x => x.wordId !== id)).slice(0, 20); }); },
    review(id, rating, token) {
      if (!['known', 'again'].includes(rating) || typeof token !== 'string' || !token) throw Error('无效复习结果');
      return mutate(s => {
        requireWord(id, s); if (s.tokens.includes(token)) return s.reviews[id];
        const previous = s.reviews[id] || { box: 0 }; const box = rating === 'known' ? Math.min(previous.box + 1, 4) : 0;
        const due = new Date(now()); due.setDate(due.getDate() + [1, 1, 3, 7, 14][box]);
        const result = { box, dueAt: dateKey(due), lastReviewedAt: dateKey(now()) };
        s.reviews[id] = result; s.tokens.push(token); day(s).reviewedWordIds = strings(day(s).reviewedWordIds.concat(id)); return result;
      });
    },
    recordAnswer(questionId, correct, token) {
      if (!questionId || typeof correct !== 'boolean' || !token) throw Error('无效练习结果');
      mutate(s => { if (s.tokens.includes(token)) return; s.tokens.push(token); day(s).answers.push({ questionId, correct }); });
    }
  };
}
const service = () => createStorageService(wx);
const exportsObject = { createStorageService, dateKey };
for (const name of ['snapshot', 'todayKey', 'favorites', 'toggle', 'addWord', 'setSelection', 'recordVisit', 'review', 'recordAnswer', 'searchHistory', 'rememberSearch', 'clearSearchHistory']) exportsObject[name] = (...args) => service()[name](...args);
module.exports = exportsObject;
