function normalizeQuery(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}
function highlight(text, query) {
  const value = String(text || '').trim().replace(/\s+/g, ' ');
  const q = normalizeQuery(query), parts = [];
  let start = 0, index;
  if (q) while ((index = value.toLowerCase().indexOf(q, start)) !== -1) {
    if (index > start) parts.push({text: value.slice(start, index), matched: false});
    parts.push({text: value.slice(index, index + q.length), matched: true});
    start = index + q.length;
  }
  if (start < value.length) parts.push({text: value.slice(start), matched: false});
  return parts.map((part, key) => ({...part, key}));
}
module.exports = {normalizeQuery, highlight};
