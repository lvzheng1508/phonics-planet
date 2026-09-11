const audio=require('../../services/audio-service');
const content=require('../../services/content-service');
const resources=require('../../services/resource-service');
let counter=0;
Component({
 properties:{ids:{type:Array,value:[]},label:{type:String,value:'听发音'},owner:{type:String,value:''},compact:{type:Boolean,value:false}},
 data:{ready:false,active:false,loading:false,preparing:false,downloadError:false},
 observers:{ids(){this.check();}},
 lifetimes:{
  attached(){this.alive=true;this.audioOwner=this.data.owner||'audio-button-'+(++counter);this.check();this.off=audio.subscribe(s=>{const active=s.owner===this.audioOwner&&(s.status==='loading'||s.status==='playing');this.setData({active,loading:active&&s.status==='loading'});});},
  detached(){this.alive=false;this.generation=(this.generation||0)+1;if(this.off)this.off();audio.stop(this.audioOwner);}
 },
 pageLifetimes:{hide(){this.hidden=true;this.generation=(this.generation||0)+1;audio.stop(this.audioOwner);},show(){this.hidden=false;this.check();}},
 methods:{
  async check(){
    if(!this.alive||this.hidden)return;
    const generation=this.generation=(this.generation||0)+1;
    this.failedId='';
    audio.stop(this.audioOwner);
    const ids=this.data.ids.slice();
    const available=ids.length>0&&ids.every(id=>content.audioPlayable(id));
    this.setData({ready:false,preparing:false,downloadError:false});
    if(!available)return;
    const remote=ids.map(id=>content.audio(id)).filter(a=>a&&String(a.src).startsWith('resource://'));
    if(!remote.length){this.setData({ready:true});return;}
    this.setData({preparing:true});
    try{
      for(const asset of remote){
        this.failedId=asset.id;
        if(!this.alive||this.hidden||this.generation!==generation)return;
        const lease=await resources.acquire(asset);lease.release();
      }
      if(this.alive&&!this.hidden&&this.generation===generation)this.setData({ready:true,preparing:false});
    }catch(error){if(this.alive&&!this.hidden&&this.generation===generation)this.setData({preparing:false,downloadError:true});}
  },
  debug(){const id=this.failedId||this.data.ids[0];if(id)wx.navigateTo({url:'/pages/resource-test/index?id='+encodeURIComponent(id)});},
  async play(){if(this.data.downloadError){this.check();return;}if(!this.data.ready)return;if(this.data.active){audio.stop(this.audioOwner);return;}try{const completed=await audio.play(this.data.ids,{owner:this.audioOwner});if(completed)this.triggerEvent('completed');}catch(error){wx.showToast({title:error.message,icon:'none'});}}
 }
});
