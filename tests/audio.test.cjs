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
test('stopping during download prevents late playback and releases the cached file',async()=>{
  const f=fixture();let finish, released=0;
  const a=createAudioService(()=>f.create(),ready,20000,{acquire:()=>new Promise(r=>{finish=r;})});
  const play=a.play(['a']);a.stop();assert.equal(await play,false);
  finish({path:'/cached/a.mp3',release(){released++;}});
  await new Promise(r=>setImmediate(r));
  assert.equal(f.contexts.length,0);assert.equal(released,1);
});
test('cached file stays pinned until audio completes',async()=>{
  const f=fixture();let released=0;
  const a=createAudioService(()=>f.create(),ready,20000,{acquire:async()=>({path:'/cached/a.mp3',release(){released++;}})});
  const play=a.play(['a']);await new Promise(r=>setImmediate(r));
  assert.equal(f.contexts[0].src,'/cached/a.mp3');assert.equal(released,0);
  f.contexts[0].ended();assert.equal(await play,true);assert.equal(released,1);
});
