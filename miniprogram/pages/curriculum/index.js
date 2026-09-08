const content = require('../../services/content-service');
const storage = require('../../services/storage-service');
const { route, toast } = require('../../utils/view');
Page({
 data: { books: [], selected: '' },
 onShow() { this.setData({ books: content.curriculums().map(b => ({ ...b, units: b.units.map((u, i) => ({ ...u, number: i + 1, url: route('unit-detail', { curriculumId: b.id, unitId: u.id }) })) })), selected: storage.snapshot().selection.unitId || '' }); },
 choose(e) { const { book, unit, url } = e.currentTarget.dataset; try { storage.setSelection(book, unit); wx.navigateTo({ url }); } catch(error) { toast(error); } }
});
