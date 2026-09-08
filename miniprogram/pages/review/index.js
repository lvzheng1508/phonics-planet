const learning=require('../../services/learning-service');
const storage=require('../../services/storage-service');
const content=require('../../services/content-service');
const audio=require('../../services/audio-service');
const {toast}=require('../../utils/view');
Page({
 data:{current:null,index:0,total:0,revealed:false,answered:false,reviewed:0,finished:false,empty:false,audioIds:[],dueAt:''},
 onLoad(){this.queue=learning.reviewQueue();this.session='review:'+Date.now()+':'+Math.random().toString(36).slice(2);this.setData({total:this.queue.length,empty:!this.queue.length});this.showCard();},
 showCard(){const current=this.queue[this.data.index];this.setData({current:current||null,revealed:false,answered:false,finished:this.queue.length>0&&!current,audioIds:current&&content.audioReady(current.audioId)?[current.audioId]:[],dueAt:''});},
 reveal(){if(this.data.current)this.setData({revealed:true});},
 rate(e){if(!this.data.current||!this.data.revealed||this.data.answered)return;try{const result=storage.review(this.data.current.id,e.currentTarget.dataset.rating,this.session+':'+this.data.index);this.setData({answered:true,reviewed:this.data.reviewed+1,dueAt:result.dueAt});}catch(error){toast(error);}},
 next(){if(!this.data.answered)return;audio.stop();this.setData({index:this.data.index+1});this.showCard();},
 onHide(){audio.stop();},onUnload(){audio.stop();}
});
