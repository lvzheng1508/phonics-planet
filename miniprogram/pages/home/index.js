const learning = require('../../services/learning-service');
const { wordCards, route } = require('../../utils/view');
Page({
  data: { summary: {}, recent: [], continueUrl: '/pages/curriculum/index' },
  onShow() {
    const summary = learning.today();
    this.setData({ summary, recent: wordCards(summary.recentWords), continueUrl: summary.unit ? route('unit-detail', { curriculumId: summary.book.id, unitId: summary.unit.id }) : '/pages/curriculum/index' });
  }
});
