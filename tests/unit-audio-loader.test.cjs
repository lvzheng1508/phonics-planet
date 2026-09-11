const {test}=require('node:test');const assert=require('node:assert/strict');
const {createLoader}=require('../miniprogram/services/unit-audio-loader');
test('unit prefetch serializes, yields to playback, pauses in background and releases leases',async()=>{
  let callback,busy=true,resolve,calls=0,releases=0;
  const loader=createLoader({delay:0,schedule:fn=>{callback=()=>{callback=null;fn();};return 1;},cancel:()=>{callback=null;},isBusy:()=>busy,
    acquire:()=>{calls++;return new Promise(r=>resolve=r);}});
  const asset={sha1:'a',extension:'mp3'};
  loader.start('u',[asset,asset],3);callback();assert.equal(calls,0);
  busy=false;callback();assert.equal(calls,1);assert.equal(callback,null);
  loader.foreground(false);resolve({release:()=>releases++});await new Promise(setImmediate);
  assert.equal(releases,1);assert.equal(callback,null);
  loader.foreground(true);callback();assert.equal(loader.state().status,'done');assert.equal(calls,1);
});
test('three consecutive failures stop automatic requests',async()=>{
  let callback,calls=0;const loader=createLoader({delay:0,schedule:fn=>{callback=fn;return 1;},cancel(){},acquire:async()=>{calls++;throw Error('offline');}});
  loader.start('u',[1,2,3,4].map(n=>({sha1:String(n),extension:'mp3'})),4);
  for(let i=0;i<3;i++){callback();await new Promise(setImmediate);}
  assert.equal(calls,3);assert.equal(loader.state().status,'paused');assert.equal(loader.state().failed,3);
});
