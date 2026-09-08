const content=require('../../services/content-service');
const audio=require('../../services/audio-service');
const {route,wordCards}=require('../../utils/view');
Page({
 data:{item:null,spellings:'',contrasts:[],audioIds:[],words:[]},
 onLoad({id}){const item=content.phoneme(id);if(!item)return;this.setData({item,spellings:item.commonSpellings.join(' · '),audioIds:[item.audioId],contrasts:item.contrast.map(content.phoneme).filter(Boolean).map(p=>({...p,url:route('phoneme-detail',{id:p.id})})),words:wordCards(content.words().filter(w=>w.enrichmentStatus==='verified'&&w.phonemes.includes(id)).slice(0,8))});},
 onHide(){audio.stop();},onUnload(){audio.stop();}
});
