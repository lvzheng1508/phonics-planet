const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createStorageService} = require('../miniprogram/services/storage-service');
const {createAudioService} = require('../miniprogram/services/audio-service');
const content = require('../miniprogram/services/content-service').createContentService(require('../miniprogram/data/generated'));
test('favorites survive service recreation, toggle and tolerate corrupt data',()=>{
 let data;const api={getStorageSync:()=>data,setStorageSync:(k,v)=>{data=v;}};
 const s=createStorageService(api); assert.deepEqual(s.favorites(),[]); assert.equal(s.toggle('word_climb'),true);
 assert.deepEqual(createStorageService(api).favorites(),['word_climb']);assert.equal(s.toggle('word_climb'),false);
 data={bad:true};assert.deepEqual(s.favorites(),[]);data=['x','x',3];assert.deepEqual(s.favorites(),['x']);
});
test('storage failures propagate to UI instead of pretending success',()=>{
 const s=createStorageService({getStorageSync:()=>[],setStorageSync:()=>{throw Error('quota');}}); assert.throws(()=>s.toggle('x'),/quota/);
});
function fixture() {const contexts=[];return {contexts,create(){const c={played:[],stopped:false,destroyed:false,onEnded(fn){this.ended=fn;},onError(fn){this.error=fn;},play(){this.played.push(this.src);},stop(){this.stopped=true;},destroy(){this.destroyed=true;}};contexts.push(c);return c;}};}
const asset=id=>({id,status:'verified',src:'/'+id+'.mp3',source:'test',license:'test',reviewer:'test'});
test('sequence advances on ended and destroys contexts',async()=>{const f=fixture(),a=createAudioService(()=>f.create(),asset);const result=a.play(['a','b']);assert.deepEqual(f.contexts[0].played,['/a.mp3']);f.contexts[0].ended();assert.deepEqual(f.contexts[1].played,['/b.mp3']);f.contexts[1].ended();assert.equal(await result,true);assert.ok(f.contexts.every(c=>c.destroyed));});
test('rapid replacement cancels previous playback; late events cannot advance it',async()=>{const f=fixture(),a=createAudioService(()=>f.create(),asset);const one=a.play(['a','b']);const two=a.play(['c']);assert.equal(await one,false);f.contexts[0].ended();assert.deepEqual(f.contexts[0].played,['/a.mp3']);a.stop();assert.equal(await two,false);assert.ok(f.contexts.every(x=>x.destroyed));});
test('missing or unreviewed audio fails without creating context',async()=>{const f=fixture(),a=createAudioService(()=>f.create(),()=>({status:'pending',src:'/a'}));await assert.rejects(a.play(['a']),/准备/);assert.equal(f.contexts.length,0);});
test('play error and timeout clean up resources',async()=>{const f=fixture(),a=createAudioService(()=>f.create(),asset,5);const p=a.play(['a']);f.contexts[0].error();await assert.rejects(p,/无法/);assert.ok(f.contexts[0].destroyed);await assert.rejects(a.play(['b']),/超时/);assert.ok(f.contexts[1].destroyed);});
test('run preserves two curriculum meanings and unknown IDs return empty',()=>{const c=content.curriculums()[0];assert.notEqual(c.units[1].entries.find(e=>e.wordId==='word_run').meaning,c.units[5].entries.find(e=>e.wordId==='word_run').meaning);assert.equal(content.word('missing'),undefined);assert.equal(content.unit('missing','missing'),undefined);});
