function route(page, params = {}) {
  const query = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  return '/pages/' + page + '/index' + (query ? '?' + query : '');
}
function wordCards(words, context = {}) { return words.map(w => ({ ...w, url: route('word-detail', { id: w.id, ...context }) })); }
function toast(error) { wx.showToast({ title: error && error.message || '未能保存，请重试', icon: 'none' }); }
module.exports = { route, wordCards, toast };
