function route(page, params = {}) {
  const query = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  return '/pages/' + page + '/index' + (query ? '?' + query : '');
}
function decodeRouteValue(value) {
  if (typeof value !== 'string') return '';
  try { return decodeURIComponent(value); } catch (_) { return value; }
}
function wordCards(words, context = {}) { const content = require('../services/content-service'); return words.map(w => ({ ...w, displayIpa: content.detail(w.id, context)?.ipa || '', url: route('word-detail', { id: w.id, ...context }) })); }
function toast(error) { wx.showToast({ title: error && error.message || '未能保存，请重试', icon: 'none' }); }
module.exports = { route, wordCards, toast, decodeRouteValue };
