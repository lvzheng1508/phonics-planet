const audio=require('../../services/audio-service');
const content=require('../../services/content-service');
let counter=0;
Component({
 properties:{ids:{type:Array,value:[]},label:{type:String,value:'听发音'},owner:{type:String,value:''},compact:{type:Boolean,value:false}},
 data:{ready:false,active:false,loading:false},
 observers:{ids(){this.check();}},
 lifetimes:{
  attached(){this.audioOwner=this.data.owner||'audio-button-'+(++counter);this.check();this.off=audio.subscribe(s=>{const active=s.owner===this.audioOwner&&(s.status==='loading'||s.status==='playing');this.setData({active,loading:active&&s.status==='loading'});});},
  detached(){if(this.off)this.off();audio.stop(this.audioOwner);}
 },
 methods:{
  check(){this.setData({ready:this.data.ids.length>0&&this.data.ids.every(id=>content.audioPlayable(id))});},
  async play(){if(!this.data.ready)return;if(this.data.active){audio.stop(this.audioOwner);return;}try{const completed=await audio.play(this.data.ids,{owner:this.audioOwner});if(completed)this.triggerEvent('completed');}catch(error){wx.showToast({title:error.message,icon:'none'});}}
 }
});
