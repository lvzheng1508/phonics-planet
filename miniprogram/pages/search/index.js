const search = require('../../services/search-service');
const content = require('../../services/content-service');
const storage = require('../../services/storage-service');
const {normalizeQuery} = require('../../utils/search-text');
const {route, toast} = require('../../utils/view');

Page({
  data: {query: '', hasQuery: false, submitted: false, results: [], total: 0, corrections: [], history: [], example: '', focused: false, hasPendingIpa: false},
  onLoad() { this.setData({example: search.example()}); },
  onShow() { this.setData({history: storage.searchHistory()}); this.refresh(); },
  refresh() {
    const result = search.search(this.data.query, {limit: this.data.submitted ? Infinity : 6});
    const results = result.items.map(item => {
      const detail = content.detail(item.id, item.context);
      return {...item, displayIpa: detail ? detail.ipa : '', pendingIpa: !!(detail && detail.pronunciationPending),
        url: route('word-detail', {id: item.id, ...item.context})};
    });
    this.setData({results, total: result.total, corrections: result.corrections,
      hasQuery: !!normalizeQuery(this.data.query), hasPendingIpa: results.some(item => item.pendingIpa)});
  },
  input(event) { this.setData({query: event.detail.value, submitted: false}); this.refresh(); },
  remember(query) {
    try { storage.rememberSearch(query); this.setData({history: storage.searchHistory()}); }
    catch (_) { toast(Error('搜索记录未能保存，仍可继续查词')); }
  },
  submit() {
    const query = normalizeQuery(this.data.query);
    if (!query) { this.clearInput(); return; }
    this.setData({query, submitted: true, focused: false});
    this.remember(query); this.refresh(); wx.hideKeyboard && wx.hideKeyboard();
  },
  chooseQuery(event) { this.setData({query: event.currentTarget.dataset.query}); this.submit(); },
  clearInput() { this.setData({query: '', submitted: false, focused: true}); this.refresh(); },
  clearHistory() {
    try { storage.clearSearchHistory(); this.setData({history: []}); }
    catch (_) { toast(Error('搜索记录未能清空，请稍后重试')); }
  },
  openWord(event) {
    const item = this.data.results.find(x => x.id === event.currentTarget.dataset.id);
    if (!item) return;
    this.remember(item.word); wx.navigateTo({url: item.url});
  },
  openSource(event) {
    const {id, key} = event.currentTarget.dataset;
    const item = this.data.results.find(x => x.id === id);
    const source = item && item.sources.find(x => x.key === key);
    if (!source) return;
    this.remember(item.word);
    wx.navigateTo({url: route('word-detail', {id, curriculumId: source.curriculumId, unitId: source.unitId})});
  },
  addWord() {
    const query = normalizeQuery(this.data.query);
    const english = /^[a-z]+(?:[ '\-][a-z]+)*$/.test(query);
    wx.navigateTo({url: route('my-words', {add: '1', word: english ? query : '', meaning: english ? '' : query})});
  }
});
