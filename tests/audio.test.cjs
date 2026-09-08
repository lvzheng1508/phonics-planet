const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAudioService}=require('../miniprogram/services/audio-service');
const ready=id=>({id,status:'verified',src:'/assets/audio/'+id+'.mp3',source:'source',license:'CC0',reviewer:'test'});
function fixture(throws=false){ const contexts=[]; return {contexts,create(){const c={onEnded(fn){this.ended=fn;},onPlay(fn){this.started=fn;},onError(fn){this.error=fn;},play(){},stop(){if(throws)throw Error('already destroyed');},destroy(){this.destroyed=true;}};contexts.push(c);return c;}};}
test('observers receive step and ownership; stale audio events cannot advance new session',async()=>{
  const f=fixture(),a=createAudioService(()=>f.create(),ready);assert.equal(typeof a.subscribe,'function');
  const states=[];const off=a.subscribe(s=>states.push(s));
  const p=a.play(['a','b'],{owner:'word'}); f.contexts[0].started();
  assert.equal(a.state().status,'playing');assert.equal(a.state().index,0);
  f.contexts[0].ended();assert.equal(a.state().index,1);
  const q=a.play(['c'],{owner:'other'});await p;
  f.contexts[0].ended();assert.equal(a.state().owner,'other');assert.equal(a.state().index,0);
  a.stop('word');assert.equal(a.state().owner,'other');
  a.stop('other');assert.equal(await q,false);assert.equal(a.state().status,'idle');
  off();assert.ok(states.length>=4);
});
test('cleanup failures cannot leave play promise pending',async()=>{
  const f=fixture(true),a=createAudioService(()=>f.create(),ready);
  const p=a.play(['a']);assert.doesNotThrow(()=>a.stop());assert.equal(await p,false);assert.ok(f.contexts[0].destroyed);
});
