const {test}=require('node:test');
const assert=require('node:assert/strict');
const {progressTokens}=require('../miniprogram/utils/phonetic-view');
test('timed fill waits for voice onset and follows unequal phone durations, excluding stress marks',()=>{
 const tokens=[{text:'ˈ',timing:{start:.2,end:.2}},{text:'w',timing:{start:.2,end:.3}},{text:'ɒ',timing:{start:.3,end:.65}},{text:'z',timing:{start:.65,end:.85}}];
 assert.deepEqual(progressTokens(tokens,.1,.1).map(t=>t.fill),[0,0,0,0]);
 assert.deepEqual(progressTokens(tokens,.25,.25).map(t=>t.fill),[100,50,0,0]);
 assert.deepEqual(progressTokens(tokens,.475,.475).map(t=>t.fill),[100,100,50,0]);
 assert.deepEqual(progressTokens(tokens,.9,.9).map(t=>t.fill),[100,100,100,100]);
 assert.deepEqual(progressTokens(tokens,0,0).map(t=>t.fill),[0,0,0,0]);
});
test('content attaches timings only when both current IPA and audio hash match',()=>{
 const data=structuredClone(require('../miniprogram/data/generated'));
 const asset=data.audio.find(a=>a.id==='word_was');
 const draft=data.pronunciations.find(p=>p.wordId==='word_was');
 data.audioTimings=[{wordId:'word_was',audioId:'word_was',audioSha1:asset.sha1,ipa:'wɒz',status:'aligned',reviewStatus:'pending',tokens:[{text:'w',start:.2,end:.3},{text:'ɒ',start:.3,end:.65},{text:'z',start:.65,end:.85}]}];
 const content=()=>require('../miniprogram/services/content-service').createContentService(data).detail('word_was');
 assert.equal(content().audioTimingReady,true);
 assert.deepEqual(content().ipaTokens[0].timing,{start:.2,end:.3});
 asset.sha1='different';assert.equal(content().audioTimingReady,false);assert.equal(content().ipaTokens[0].timing,undefined);
 asset.sha1=data.audioTimings[0].audioSha1;draft.ipa='wəz';assert.equal(content().audioTimingReady,false);
});
test('all curriculum IPA timelines finish at the spoken tail and survive stop/replay',()=>{
 const data=require('../miniprogram/data/generated');
 const content=require('../miniprogram/services/content-service').createContentService(data);
 for(const word of data.words){
  const item=content.detail(word.id);assert.equal(item.audioTimingReady,true,word.word);
  const asset=content.audio(item.audioId);
  assert.ok(item.ipaTokens.at(-1).timing.end<asset.duration,word.word+' excludes tail silence');
  assert.ok(progressTokens(item.ipaTokens,0,0).every(t=>t.fill===0),word.word);
  assert.ok(progressTokens(item.ipaTokens,1,asset.duration).every(t=>t.fill===100),word.word);
  assert.ok(progressTokens(item.ipaTokens,0,0).every(t=>t.fill===0),word.word+' replay reset');
 }
 const house=content.detail('word_gingerbread_house');
 const h=house.ipaTokens.find(t=>t.text==='h');
 assert.ok(h.timing.start>=.9&&h.timing.start<=1.15,'house begins with the second spoken word');
 const before=progressTokens(house.ipaTokens,.4,h.timing.start-.05);
 assert.equal(before.find(t=>t.text==='h').fill,0);
 const during=progressTokens(house.ipaTokens,.9,(h.timing.start+h.timing.end)/2);
 assert.equal(during.find(t=>t.text==='h').fill,50,'uses media seconds, independent of whole-file fraction');
});
test('malformed, overlapping, or out-of-recording timing data safely falls back',()=>{
 const original=require('../miniprogram/data/generated');
 for(const mutate of [t=>{t.tokens=null;},t=>{t.tokens[0]=null;},t=>{t.tokens[0].end=100;},t=>{t.tokens[0].end=t.tokens[1].end;}]){
  const data=structuredClone(original),timing=data.audioTimings.find(t=>t.wordId==='word_was');mutate(timing);
  const detail=require('../miniprogram/services/content-service').createContentService(data).detail('word_was');
  assert.equal(detail.audioTimingReady,false);assert.ok(detail.ipaTokens.every(t=>!t.timing));
 }
});
test('detail and review use current clip seconds and ignore another word sharing their owner',()=>{
 const audio=require('../miniprogram/services/audio-service');
 const storage=require('../miniprogram/services/storage-service');
 const item=require('../miniprogram/services/content-service').createContentService(require('../miniprogram/data/generated')).detail('word_gingerbread_house');
 const oldSubscribe=audio.subscribe,oldFavorites=storage.favorites;
 let listener; audio.subscribe=fn=>{listener=fn;return ()=>{};};storage.favorites=()=>[];
 try {
  for(const [page,key,owner] of [['word-detail','item','word-whole'],['review','current','review-whole']]){
   let definition;global.Page=p=>{definition=p;};
   const file=require.resolve('../miniprogram/pages/'+page+'/index');delete require.cache[file];require(file);
   const instance={...definition,data:{[key]:item},setData(x){Object.assign(this.data,x);}};instance.onShow();
   const h=item.ipaTokens.find(t=>t.text==='h').timing;
   listener({owner,audioId:item.audioId,status:'playing',currentTime:(h.start+h.end)/2,progress:.99});
   assert.equal(instance.data.ipaTokens.find(t=>t.text==='h').fill,50,page);
   listener({owner,audioId:'word_was',status:'playing',currentTime:1,progress:.99});
   assert.equal(instance.data.playing,false);assert.ok(instance.data.ipaTokens.every(t=>t.fill===0));
  }
 } finally {audio.subscribe=oldSubscribe;storage.favorites=oldFavorites;delete global.Page;}
});
