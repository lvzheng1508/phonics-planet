const content = require('./content-service');
const {normalizeQuery, highlight} = require('../utils/search-text');

// Adjacent swapped letters count as one edit, as do insertions and deletions.
function editDistance(a, b) {
  const rows = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

function createSearchService(catalog) {
  function records() {
    const byId = new Map(catalog.words().map(w => [w.id, {...w, sources: [], custom: w.id.startsWith('custom_')}]));
    catalog.curriculums().forEach(c => c.units.forEach(u => u.entries.forEach(entry => {
      const item = byId.get(entry.wordId);
      if (item) item.sources.push({key: c.id + ':' + u.id, curriculumId: c.id, unitId: u.id, label: c.name + ' · ' + u.name, meaning: entry.meaning});
    })));
    return [...byId.values()];
  }
  function present(item, q) {
    const source = item.sources.find(s => normalizeQuery(s.meaning).includes(q)) || item.sources[0];
    const meaning = (source && normalizeQuery(source.meaning).includes(q) && source.meaning)
      || item.meanings.find(m => normalizeQuery(m).includes(q)) || (source && source.meaning) || item.meanings[0] || '';
    return {...item, meaning, context: source ? {curriculumId: source.curriculumId, unitId: source.unitId} : {},
      wordParts: highlight(item.word, q), meaningParts: highlight(meaning, q)};
  }
  return {
    example() {
      const item = catalog.words().find(w => w.meanings.length && w.word.length <= 16);
      return item ? item.word + ' / ' + item.meanings[0] : '';
    },
    search(query, {limit = Infinity} = {}) {
      const q = normalizeQuery(query).slice(0, 80);
      if (!q) return {total: 0, items: [], corrections: []};
      const all = records(), matches = [];
      for (const item of all) {
        const name = normalizeQuery(item.word);
        const rank = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2
          : item.meanings.concat(item.sources.map(s => s.meaning)).some(m => normalizeQuery(m).includes(q)) ? 3 : -1;
        if (rank >= 0) matches.push({item, rank});
      }
      matches.sort((a, b) => a.rank - b.rank || a.item.word.localeCompare(b.item.word, 'en'));
      let corrections = [];
      if (!matches.length && q.length >= 4 && /^[a-z]+(?:[ '\-][a-z]+)*$/.test(q)) {
        const maxEdits = q.length >= 8 ? 2 : 1;
        corrections = all.filter(item => Math.abs(item.word.length - q.length) <= maxEdits)
          .map(item => ({item, distance: editDistance(q, normalizeQuery(item.word))}))
          .filter(x => x.distance <= maxEdits && x.distance / Math.max(q.length, x.item.word.length) <= 0.25)
          .sort((a, b) => a.distance - b.distance || a.item.word.localeCompare(b.item.word, 'en'))
          .slice(0, 3).map(x => ({id: x.item.id, word: x.item.word}));
      }
      return {total: matches.length, items: matches.slice(0, limit).map(x => present(x.item, q)), corrections};
    }
  };
}
module.exports = {...createSearchService(content), createSearchService};
