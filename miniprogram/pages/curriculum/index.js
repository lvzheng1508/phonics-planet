const content = require('../../services/content-service');
Page({ data: { books: [] }, onLoad() { this.setData({books:content.curriculums()}); } });
