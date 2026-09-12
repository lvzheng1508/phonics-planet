const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('download page shows install progress and completion, and cancellation is forwarded',async()=>{
 let page,listener,finish,cancelled=false;
 const bundle={subscribe(fn){listener=fn;fn({status:'idle',total:145,bytes:2265358});return()=>{listener=null;};},inspect:async()=>{},install(){listener({status:'downloading',progress:20});return new Promise(r=>finish=r);},cancel(){cancelled=true;}};
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/audio-download/index.js','utf8'),{Page:p=>page=p,require:()=>bundle});
 const instance={...page,data:{...page.data},setData(p){Object.assign(this.data,p);}};
 instance.onLoad();await instance.onShow();const job=instance.download();assert.equal(instance.data.busy,true);assert.equal(instance.data.progress,20);
 listener({status:'extracting'});assert.equal(instance.data.busy,true);
 listener({status:'ready',ready:true,count:145});finish();await job;assert.equal(instance.data.ready,true);assert.equal(instance.data.busy,false);
 instance.onUnload();assert.equal(cancelled,true);assert.equal(listener,null);
});

test('redownload stops playback and finishes clearing all audio before installing; repeated taps do not overlap',async()=>{
 let page,listener,finishClear;const events=[];
 const bundle={subscribe(fn){listener=fn;fn({status:'ready',ready:true,count:145,total:145,bytes:2265358});return()=>{};},inspect:async()=>{},install:async()=>{events.push('install');listener({status:'ready',ready:true});},cancel(){}};
 const resources={clear:()=>{events.push('clear');listener({status:'idle',ready:false});return new Promise(r=>finishClear=r);}};
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/audio-download/index.js','utf8'),{Page:p=>page=p,require:id=>id.includes('audio-bundle')?bundle:id.includes('resource-service')?resources:{stop:()=>events.push('stop')}});
 const instance={...page,data:{...page.data},setData(p){Object.assign(this.data,p);}};instance.onLoad();await instance.onShow();
 const job=instance.redownload();await instance.redownload();assert.deepEqual(events,['stop','clear']);assert.equal(instance.data.busy,true);
 finishClear();await job;assert.deepEqual(events,['stop','clear','install']);assert.equal(instance.data.busy,false);assert.equal(instance.data.ready,true);
});

test('clear failure or leaving during clear never starts a replacement download',async()=>{
 for(const leave of [false,true]){
  let page,finishClear,installed=false;
  const bundle={subscribe(fn){fn({status:'ready',ready:true,total:145,bytes:100});return()=>{};},inspect:async()=>{},install:async()=>{installed=true;},cancel(){}};
  const resources={clear:()=>leave?new Promise(r=>finishClear=r):Promise.reject(Error('disk error'))};
  vm.runInNewContext(fs.readFileSync('miniprogram/pages/audio-download/index.js','utf8'),{Page:p=>page=p,require:id=>id.includes('audio-bundle')?bundle:id.includes('resource-service')?resources:{stop(){}}});
  const instance={...page,data:{...page.data},setData(p){Object.assign(this.data,p);}};instance.onLoad();await instance.onShow();const job=instance.redownload();
  if(leave){instance.onUnload();finishClear();}await job;assert.equal(installed,false);
  if(!leave){assert.equal(instance.data.busy,false);assert.match(instance.data.error,/清除/);}
 }
});
