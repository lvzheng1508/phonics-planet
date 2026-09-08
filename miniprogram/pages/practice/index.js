const practice=require('../../services/practice-service');
const storage=require('../../services/storage-service');
const audio=require('../../services/audio-service');
const {toast}=require('../../utils/view');
Page({
 data:{type:'',current:null,index:0,total:0,answered:false,selected:'',correct:false,score:0,finished:false,empty:false,heard:false,types:[{id:'listen-word',name:'听音选词',note:'听到的声音，对应哪个词？'},{id:'word-ipa',name:'看词选音标',note:'帮单词找到它的发音。'},{id:'same-sound',name:'寻找同类音',note:'哪个词藏着相同的元音？'}]},
 onLoad({type}={}){if(type)this.start(type);},
 chooseType(e){this.start(e.currentTarget.dataset.type);},
 start(type){audio.stop();this.questions=practice.createSession(type,[],Date.now());this.session='practice:'+Date.now()+':'+Math.random().toString(36).slice(2);this.setData({type,index:0,total:this.questions.length,score:0,finished:false,empty:!this.questions.length});this.showQuestion();},
 showQuestion(){this.setData({current:this.questions[this.data.index]||null,answered:false,selected:'',correct:false,heard:false});},
 listened(){this.setData({heard:true});},
 answer(e){const q=this.data.current;const id=e.currentTarget.dataset.id;if(!q||this.data.answered||!q.options.some(x=>x.id===id))return;if(q.type==='listen-word'&&!this.data.heard){toast(Error('先听完这个词，再来选择'));return;}const correct=id===q.answerId;try{storage.recordAnswer(q.id,correct,this.session+':'+this.data.index);audio.stop();this.setData({answered:true,selected:id,correct,score:this.data.score+(correct?1:0)});}catch(error){toast(error);}},
 next(){if(!this.data.answered)return;audio.stop();const index=this.data.index+1;this.setData({index,finished:index>=this.questions.length});this.showQuestion();},
 back(){audio.stop();this.setData({type:'',current:null,empty:false,finished:false});},
 onHide(){audio.stop();},onUnload(){audio.stop();}
});
