const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAudioService}=require('../miniprogram/services/audio-service');
test('progress samples the real media clock between sparse native events and stops with the clip',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 let clip,reads=0;
 const service=createAudioService(()=>clip={time:0,get currentTime(){reads++;return this.time;},duration:2,
   onPlay(fn){this.started=fn;},onTimeUpdate(){},onEnded(){},onError(){},play(){},stop(){},destroy(){}},
   ()=>({kind:'word',status:'verified',src:'/sound.mp3',source:'fixture',license:'CC0',reviewer:'test'}));
 const result=service.play(['word'],{owner:'word'});
 clip.started();clip.time=.6;t.mock.timers.tick(60);
 assert.equal(service.state().progress,.3);
 // A stalled media clock must not produce a fabricated time-based sweep.
 t.mock.timers.tick(300);assert.equal(service.state().progress,.3);
 service.stop();await result;const stoppedReads=reads;
 t.mock.timers.tick(300);assert.equal(reads,stoppedReads);
 assert.equal(service.state().progress,0);
});
test('playback progress follows media clock and ignores cancelled clip updates',async()=>{
 const contexts=[];
 const create=()=>{const c={currentTime:0,duration:2,onTimeUpdate(fn){this.tick=fn;},onPlay(fn){this.started=fn;},onEnded(fn){this.ended=fn;},onError(){},play(){},stop(){},destroy(){}};contexts.push(c);return c;};
 const a=createAudioService(create,id=>({id,status:'verified',src:'/sound.wav',source:'fixture',license:'CC0',reviewer:'test'}));
 const first=a.play(['a'],{owner:'word'});contexts[0].started();
 assert.equal(typeof contexts[0].tick,'function');
 contexts[0].currentTime=.5;contexts[0].tick();assert.equal(a.state().progress,.25);
 const second=a.play(['b'],{owner:'other'});assert.equal(await first,false);
 contexts[0].currentTime=1;contexts[0].tick();assert.equal(a.state().progress,0);
 contexts[1].started();contexts[1].currentTime=10;contexts[1].tick();assert.equal(a.state().progress,1);
 a.stop();assert.equal(await second,false);assert.equal(a.state().progress,0);
});
test('preview audio policy cannot make synthetic or pending phoneme recordings production-ready',()=>{
 const {isPlayableAsset}=require('../miniprogram/services/audio-policy');
 const preview={kind:'word',status:'preview',src:'/preview-audio/moon.wav',source:'system',license:'local-preview-only'};
 assert.equal(isPlayableAsset(preview),false);
 assert.equal(isPlayableAsset(preview,true),true);
 assert.equal(isPlayableAsset({...preview,kind:'phoneme'},true),false);
 assert.equal(isPlayableAsset({...preview,status:'pending'},true),false);
});
test('every curriculum word displays labelled IPA independently of missing recordings',()=>{
 const data=require('../miniprogram/data/generated');
 const content=require('../miniprogram/services/content-service').createContentService({...data,audio:data.audio.map(a=>({...a,src:null,status:'missing'}))});
 for(const word of data.words){
   const detail=content.detail(word.id);
   assert.ok(detail.hasIpa,word.word);assert.ok(detail.pronunciationPending);
   assert.equal(detail.ipaTokens.map(t=>t.text).join(''),detail.ipa);
   assert.equal(detail.audioReady,false);assert.equal(detail.audioPlayable,false);
 }
 assert.equal(content.detail('word_gingerbread_house').ipa,'ˈdʒɪndʒəbred ˌhaʊs');
 assert.equal(content.detail('word_moon').ipa,'muːn');
});
test('release configuration hides drafts without changing their review status',()=>{
 const config=require('../miniprogram/config');
 const content=require('../miniprogram/services/content-service').createContentService(require('../miniprogram/data/generated'));
 config.showDraftPronunciations=false;
 try{assert.equal(content.detail('word_moon').hasIpa,false);}finally{config.showDraftPronunciations=true;}
 assert.equal(content.transcription('word_moon').status,'pending');
});
test('sweep supports long IPA, partial fill, stop reset and spaces without inventing timings',()=>{
 const {progressTokens}=require('../miniprogram/utils/phonetic-view');
 const tokens=[{text:'aɪ'},{text:' '},{text:'m'}];
 assert.deepEqual(progressTokens(tokens,.375).map(t=>t.fill),[75,0,0]);
 assert.deepEqual(progressTokens(tokens,1).map(t=>t.fill),[100,100,100]);
 assert.deepEqual(progressTokens(tokens,0).map(t=>t.fill),[0,0,0]);
});
test('approved pronunciation replaces draft text and clickable tokens together',()=>{
 const data=structuredClone(require('../miniprogram/data/generated'));
 const word=data.words.find(w=>w.id==='word_read');
 Object.assign(word,{ipa:'red',enrichmentStatus:'verified',phonemes:['ipa_r','ipa_e','ipa_d'],segments:[]});
 const detail=require('../miniprogram/services/content-service').createContentService(data).detail(word.id);
 assert.equal(detail.ipaTokens.map(t=>t.text).join(''),'red');
 assert.equal(detail.pronunciationPending,false);
 assert.equal(detail.ipaTokens[0].phonemeId,'ipa_r');
});
