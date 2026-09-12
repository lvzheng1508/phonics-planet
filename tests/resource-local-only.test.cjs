const {test}=require('node:test');const assert=require('node:assert/strict');
const {createResourceCache}=require('../miniprogram/services/resource-service');
test('local-only lookup never downloads a missing or corrupt audio file',async()=>{
 let downloaded=false;
 const cache=createResourceCache({readIndex:()=>[],list:()=>[],download:async()=>{downloaded=true;throw Error('unexpected network');}},()=> 'https://example.test');
 await assert.rejects(cache.acquire({src:'resource://a.mp3',sha1:'a'.repeat(40),bytes:10,extension:'mp3'},{download:false}),e=>e.code==='AUDIO_NOT_INSTALLED');
 assert.equal(downloaded,false);
 const asset={src:'resource://a.mp3',sha1:'a'.repeat(40),bytes:10,extension:'mp3'};
 const key=asset.sha1+'.mp3';let removed=false;
 const corrupt=createResourceCache({readIndex:()=>[{...asset,key,path:'/cache/'+key}],list:()=>['/cache/'+key],info:async()=>({size:9,digest:'b'.repeat(40)}),remove:async()=>{removed=true;},writeIndex(){},download:async()=>{downloaded=true;throw Error('unexpected network');}},()=> 'https://example.test');
 await assert.rejects(corrupt.acquire(asset,{download:false}),e=>e.code==='AUDIO_NOT_INSTALLED');
 assert.equal(removed,true);assert.equal(downloaded,false);
});
