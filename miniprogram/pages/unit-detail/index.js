const content = require('../../services/content-service');
const storage = require('../../services/storage-service');
const { wordCards, toast } = require('../../utils/view');
Page({
 data: { unit: null, entries: [], query: '', count: 0 },
 onLoad({ curriculumId, unitId }) { this.context = { curriculumId, unitId }; const unit = content.unit(curriculumId, unitId); if (!unit) return; this.setData({ unit, count: unit.entries.length }); try { storage.setSelection(curriculumId, unitId); } catch(error) { toast(error); } this.refresh(); },
 search(e) { this.setData({ query: e.detail.value }); this.refresh(); },
 onShow() { if(this.context&&this.data.unit)this.refresh(); },
 refresh() { const { curriculumId, unitId } = this.context; this.setData({ entries: wordCards(content.unitWords(curriculumId, unitId, this.data.query), this.context) }); }
});
