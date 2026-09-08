const learning=require('../../services/learning-service');
const storage=require('../../services/storage-service');
const content=require('../../services/content-service');
const audio=require('../../services/audio-service');
const {toast}=require('../../utils/view');
const {progressTokens}=require('../../utils/phonetic-view');
Page({
 data:{current:null,index:0,total:0,revealed:false,answered:false,reviewed:0,finished:false,empty:false,audioIds:[],dueAt:'',ipaTokens:[],playing:false},
 onLoad(){this.queue=learning.reviewQueue();this.session='review:'+Date.now()+':'+Math.random().toString(36).slice(2);this.setData({total:this.queue.length,empty:!this.queue.length});this.showCard();},
 showCard(){const word=this.queue[this.data.index];const current=word?content.detail(word.id):null;this.setData({current,revealed:false,answered:false,finished:this.queue.length>0&&!current,audioIds:current&&content.audioPlayable(current.audioId)?[current.audioId]:[],dueAt:'',ipaTokens:current?progressTokens(current.ipaTokens):[]});},
 onShow(){this.off=audio.subscribe(state=>{const playing=state.owner==='review-whole'&&state.status==='playing';this.setData({playing,ipaTokens:this.data.current?progressTokens(this.data.current.ipaTokens,playing?state.progress:0):[]});});},
 reveal(){if(this.data.current)this.setData({revealed:true});},
 rate(e){if(!this.data.current||!this.data.revealed||this.data.answered)return;try{const result=storage.review(this.data.current.id,e.currentTarget.dataset.rating,this.session+':'+this.data.index);this.setData({answered:true,reviewed:this.data.reviewed+1,dueAt:result.dueAt});}catch(error){toast(error);}},
 next(){if(!this.data.answered)return;audio.stop();this.setData({index:this.data.index+1});this.showCard();},
 onHide(){audio.stop();if(this.off)this.off();this.off=null;},onUnload(){this.onHide();}
});
