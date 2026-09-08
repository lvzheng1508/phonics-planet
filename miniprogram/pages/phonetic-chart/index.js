const content=require('../../services/content-service');
const {route}=require('../../utils/view');
Page({
 data:{selected:'short',groups:[{id:'short',name:'短元音'},{id:'long',name:'长元音'},{id:'diphthong',name:'双元音'},{id:'consonant',name:'辅音'}],items:[]},
 onLoad(){this.refresh();},
 select(e){this.setData({selected:e.currentTarget.dataset.id});this.refresh();},
 refresh(){const id=this.data.selected;this.setData({items:content.phonemes().filter(p=>id==='consonant'?p.category===id:p.subCategory===id).map(p=>({...p,spellings:p.commonSpellings.join(' · '),url:route('phoneme-detail',{id:p.id})}))});}
});
