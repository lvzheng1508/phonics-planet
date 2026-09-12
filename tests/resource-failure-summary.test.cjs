const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createResourceCache}=require('../miniprogram/services/resource-service');
const {createWxResourceAdapter}=require('../miniprogram/services/wx-resource-adapter');
const log=require('../miniprogram/services/diagnostic-log');
const asset={id:'word_was',text:'was',src:'resource://words/was.mp3',sha1:'a'.repeat(40),bytes:13005,extension:'mp3'};
const url='https://example.test/words/was.mp3?token=PRIVATE';
function adapter(mode){
 return createWxResourceAdapter({env:{USER_DATA_PATH:'wxfile://usr'},getFileSystemManager:()=>({
  accessSync(){},readFileSync(){throw Error('no index');},readdirSync(){return [];},
  getFileInfo(a){a.success({size:mode==='html'?33000:13006,digest:'b'.repeat(40)});},
  readFile(a){a.success({data:'<title>Sign in</title><p>Please log in</p>'+ 'x'.repeat(6000)});},
  unlink(a){a.success?.();},saveFile(){assert.fail('bad responses cannot be saved');}
 }),downloadFile(a){
  if(mode==='network')a.fail({errMsg:'downloadFile:fail url not in domain list',errno:600002});
  else a.success({statusCode:200,tempFilePath:'wxfile://temporary',header:{'Content-Type':mode==='html'?'text/html; charset=utf-8':'audio/mpeg','Content-Length':mode==='html'?'33000':'13006','Location':'https://example.test/login?secret=PRIVATE'}});
 }},'test');
}
test('one resource failure record contains request, response and error for HTML, network and validation failures',async()=>{
 for(const mode of ['html','network','mismatch']){
  log.clear();const cache=createResourceCache(adapter(mode),()=>url);
  await assert.rejects(cache.acquire(asset));
  const entries=log.list().filter(e=>e.event==='resource.error');assert.equal(entries.length,1);
  const detail=JSON.parse(entries[0].detail);
  assert.equal(detail.id,'word_was');assert.equal(detail.word,'was');
  assert.equal(detail.requestUrl,url.split('?')[0]);assert.equal(detail.expectedBytes,13005);
  assert.equal(detail.expectedSha1,asset.sha1);assert.ok(detail.error.message);assert.ok(detail.requestId);
  assert.doesNotMatch(entries[0].detail,/PRIVATE/);
  if(mode==='network'){
   assert.equal(detail.statusCode,null);assert.equal(detail.contentType,null);
   assert.equal(detail.stage,'download');assert.equal(detail.nativeErrorCode,600002);
  }else{
   assert.equal(detail.statusCode,200);assert.equal(detail.location,'https://example.test/login');
   if(mode==='html'){
    assert.equal(detail.contentType,'text/html; charset=utf-8');assert.equal(detail.actualBytes,33000);
    assert.match(detail.responseSummary,/Sign in.*Please log in/);assert.equal(detail.summaryTruncated,true);
   }else{
    assert.equal(detail.stage,'validate');assert.equal(detail.actualBytes,13006);assert.equal(detail.actualSha1,'b'.repeat(40));
   }
  }
 }
});
test('a save failure keeps response metadata after a successful download',async()=>{
 log.clear();
 const cache=createResourceCache({readIndex:()=>[],list:()=>[],download:async(url,context)=>{Object.assign(context,{statusCode:200,contentType:'audio/mpeg'});return 'tmp';},info:async()=>({size:13005,digest:asset.sha1}),save:async()=>{throw Error('disk full');},remove:async()=>{}},()=>url);
 await assert.rejects(cache.acquire(asset),/disk full/);
 const detail=JSON.parse(log.list().find(e=>e.event==='resource.error').detail);
 assert.equal(detail.stage,'cache-save');assert.equal(detail.statusCode,200);assert.equal(detail.responseSummary,null);assert.equal(detail.requestUrl,url.split('?')[0]);
});
