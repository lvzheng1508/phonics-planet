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
