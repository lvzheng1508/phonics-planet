const learning=require('../../services/learning-service');
const {wordCards}=require('../../utils/view');
Page({data:{summary:{},words:[]},onShow(){const summary=learning.today();this.setData({summary,words:wordCards(summary.newWords,summary.unit?{curriculumId:summary.book.id,unitId:summary.unit.id}:{})});}});
