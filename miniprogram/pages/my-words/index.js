const content=require('../../services/content-service');
const storage=require('../../services/storage-service');
const {wordCards,toast,decodeRouteValue}=require('../../utils/view');
Page({
 data:{words:[],query:'',adding:false,newWord:'',newMeaning:'',error:''},
 onLoad(options){if(options.add==='1')this.setData({adding:true,newWord:decodeRouteValue(options.word).slice(0,80),newMeaning:decodeRouteValue(options.meaning).slice(0,120)});},
 onShow(){this.refresh();},
 refresh(){const ids=storage.favorites();this.setData({words:wordCards(content.words(this.data.query).filter(w=>ids.includes(w.id)))});},
 search(e){this.setData({query:e.detail.value});this.refresh();},
 showAdd(){this.setData({adding:!this.data.adding,error:''});},
 inputWord(e){this.setData({newWord:e.detail.value});},
 inputMeaning(e){this.setData({newMeaning:e.detail.value});},
 saveWord(){try{storage.addWord(this.data.newWord,this.data.newMeaning);this.setData({adding:false,newWord:'',newMeaning:'',query:'',error:''});this.refresh();}catch(error){this.setData({error:error.message});toast(error);}}
});
