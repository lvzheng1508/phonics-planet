const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function mount(acquire,available=true){
 let definition,plays=0;const navigation=[];
 const audio={stop(){},subscribe(){return()=>{};},play:async()=>{plays++;return true;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../miniprogram/components/audio-button/index.js'),'utf8'),{wx:{navigateTo:o=>navigation.push(o.url)},Component:d=>definition=d,require:id=>id.includes('audio-service')?audio:id.includes('content-service')?{audioPlayable:()=>available,audio:()=>({src:'resource://a.mp3'})}:{acquire}});
 const instance={data:{...definition.data,ids:['a'],owner:''},setData(data){Object.assign(this.data,data);},triggerEvent(){},...definition.methods};
 definition.lifetimes.attached.call(instance);
 return {instance,definition,plays:()=>plays,navigation};
}
test('local audio enables playback; missing audio navigates to bundle download and refreshes on return',async()=>{
 let resolve,released=0;
 const {instance,plays}=mount(()=>new Promise(r=>resolve=r));
 assert.equal(instance.data.preparing,true);assert.equal(instance.data.ready,false);
 resolve({release:()=>released++});await new Promise(setImmediate);
 assert.equal(instance.data.ready,true);assert.equal(released,1);assert.equal(plays(),0);
 await instance.play();assert.equal(plays(),1);
 let fail=true;const failed=mount(async()=>{if(fail)throw Error('network');return{release(){}};});
 await new Promise(setImmediate);assert.equal(failed.instance.data.downloadError,true);
 await failed.instance.play();assert.deepEqual(failed.navigation,['/pages/audio-download/index']);assert.equal(failed.instance.data.ready,false);
 fail=false;failed.definition.pageLifetimes.show.call(failed.instance);await new Promise(setImmediate);assert.equal(failed.instance.data.ready,true);
});
test('missing recordings never download, and late downloads cannot update a detached button',async()=>{
 let calls=0;mount(()=>{calls++;},false);assert.equal(calls,0);
 let resolve,released=0;const {instance,definition}=mount(()=>new Promise(r=>resolve=r));
 definition.lifetimes.detached.call(instance);resolve({release:()=>released++});await new Promise(setImmediate);
 assert.equal(released,1);assert.equal(instance.data.ready,false);
});
test('missing local audio shows download prompt which clears once installed',async()=>{
 for(const code of ['RESOURCE_HTML_RESPONSE','RESOURCE_DOMAIN_BLOCKED',undefined]){
  let fail=true;
  const mounted=mount(async()=>{if(fail)throw Object.assign(Error('detail'),{code});return{release(){}};});
  await new Promise(setImmediate);assert.equal(mounted.instance.data.errorMessage,'尚未下载音频');
  fail=false;await mounted.instance.check();assert.equal(mounted.instance.data.errorMessage,'');
 }
});
