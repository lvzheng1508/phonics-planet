const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
function harness(){
  const db={}; const navigations=[]; const toasts=[];
  global.wx={getStorageSync:k=>db[k],setStorageSync:(k,v)=>{db[k]=structuredClone(v);},navigateTo:({url})=>navigations.push(url),showToast:x=>toasts.push(x.title),setNavigationBarTitle(){}};
  function load(name,query={}){
    let definition;global.Page=p=>{definition=p;};
    const file=path.resolve(__dirname,'../miniprogram/pages/'+name+'/index.js');delete require.cache[file];require(file);
    const p={...definition,data:structuredClone(definition.data||{}),setData(value){Object.assign(this.data,value);}};
    if(p.onLoad)p.onLoad(query);if(p.onShow)p.onShow();return p;
  }
  return {load,db,navigations,toasts};
}
test('word page keeps unit meaning, records visit and handles unknown word',()=>{
  const h=harness();const p=h.load('word-detail',{id:'word_run',curriculumId:'pep_2026_g6_s1',unitId:'unit_6'});
  assert.equal(p.data.item.contextMeaning,'使运行');
  const today=h.load('home');assert.equal(today.data.summary.visitedCount,1);
  p.toggle();assert.equal(p.data.favorite,true);
  const missing=h.load('word-detail',{id:'missing'});assert.equal(missing.data.item,null);
  if(p.onUnload)p.onUnload();
});
test('custom-word form persists to collection, detail route encodes phrases',()=>{
  const h=harness(),p=h.load('my-words');
  assert.equal(typeof p.saveWord,'function');
  p.setData({newWord:'star fish',newMeaning:'海星'});p.saveWord();
  assert.equal(p.data.words[0].word,'star fish');
  assert.match(p.data.words[0].url,/custom_star%2520fish/);
  assert.equal(h.load('my-words').data.words.length,1);
});
test('review requires reveal and guards double submission before next card',()=>{
  const h=harness();const w=h.load('word-detail',{id:'word_moon'});w.toggle();
  const p=h.load('review');assert.equal(p.data.current.word,'moon');
  p.rate({currentTarget:{dataset:{rating:'known'}}});assert.equal(p.data.reviewed,0);
  p.reveal();p.rate({currentTarget:{dataset:{rating:'known'}}});p.rate({currentTarget:{dataset:{rating:'known'}}});
  assert.equal(p.data.reviewed,1);assert.equal(p.data.answered,true);
  p.next();assert.equal(p.data.finished,true);
  assert.equal(h.load('home').data.summary.reviewedCount,1);
  w.onUnload();
});
test('practice with no eligible source data shows empty state instead of fabricated question',()=>{
  const h=harness();const p=h.load('practice',{type:'listen-word'});
  assert.equal(p.data.current,null);assert.equal(p.data.empty,true);
});

test('audio button component uses WeChat-compatible class selectors',()=>{
  const wxml=fs.readFileSync(path.resolve(__dirname,'../miniprogram/components/audio-button/index.wxml'),'utf8');
  const wxss=fs.readFileSync(path.resolve(__dirname,'../miniprogram/components/audio-button/index.wxss'),'utf8');
  assert.match(wxml,/class="audio-button__control/);
  assert.doesNotMatch(wxss,/(^|[},])\s*button(?=[\[:{])/);
  assert.doesNotMatch(wxss,/\[[^\]]+\]/);
});
test('storage save failure leaves review card unanswered and retryable',()=>{
  const h=harness();const w=h.load('word-detail',{id:'word_moon'});w.toggle();const p=h.load('review');p.reveal();
  global.wx.setStorageSync=()=>{throw Error('quota');};p.rate({currentTarget:{dataset:{rating:'known'}}});
  assert.equal(p.data.answered,false);assert.equal(p.data.reviewed,0);assert.ok(h.toasts.length>0);w.onUnload();
});

test('listening practice gates answers, retries failed saves and finishes with real score',()=>{
  const h=harness();
  const service=require('../miniprogram/services/practice-service');
  const original=service.createSession;
  const q={id:'fixture',type:'listen-word',wordId:'word_moon',word:'moon',audioIds:['word_moon'],answerId:'moon',options:[{id:'moon',label:'moon'},{id:'sky',label:'sky'},{id:'dry',label:'dry'}]};
  service.createSession=()=>[q,{...q,id:'fixture:2'}];
  try {
    const p=h.load('practice',{type:'listen-word'});
    const choose=id=>p.answer({currentTarget:{dataset:{id}}});
    choose('moon');assert.equal(p.data.answered,false);
    p.listened();const save=wx.setStorageSync;
    wx.setStorageSync=()=>{throw Error('quota');};
    choose('moon');assert.equal(p.data.answered,false);assert.equal(p.data.score,0);
    wx.setStorageSync=save;choose('moon');choose('moon');
    assert.equal(p.data.score,1);
    p.next();assert.equal(p.data.heard,false);assert.equal(p.data.index,1);
    p.listened();choose('sky');assert.equal(p.data.correct,false);
    p.next();assert.equal(p.data.finished,true);assert.equal(p.data.current,null);
    const home=h.load('home');assert.equal(home.data.summary.answeredCount,2);assert.equal(home.data.summary.correctCount,1);
  } finally { service.createSession=original; }
});
