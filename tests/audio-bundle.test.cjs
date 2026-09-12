const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const hash=b=>crypto.createHash('sha1').update(b).digest('hex');

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'phonics-bundle-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source');fs.mkdirSync(source);
 const assets=Array.from({length:145},(_,i)=>{
  const data=Buffer.from('audio fixture '+i),sha1=hash(data);
  fs.writeFileSync(path.join(source,sha1+'.mp3'),data);
  return{id:'word_'+i,src:'resource://audio/'+i+'.mp3',sha1,bytes:data.length,extension:'mp3'};
 });
 const archive=path.join(root,'bundle.zip');execFileSync('zip',['-q',archive,...fs.readdirSync(source)],{cwd:source});
 const bytes=fs.readFileSync(archive);
 const descriptor={src:'resource://bundles/test.zip',sha1:hash(bytes),bytes:bytes.length,fileCount:145,unpackedBytes:assets.reduce((s,a)=>s+a.bytes,0)};
 let downloads=0,fail=false,badBody=false,failCommit=false;
 const respond=(a,fn)=>{try{a.success?.(fn());}catch(e){a.fail?.({errMsg:e.message});}};
 const fsm={accessSync:fs.accessSync,mkdirSync:(p)=>fs.mkdirSync(p,{recursive:true}),readFileSync:fs.readFileSync,writeFileSync:fs.writeFileSync,readdirSync:fs.readdirSync,
  renameSync:(a,b)=>{if(failCommit&&b.endsWith('active.json'))throw Error('disk full');fs.renameSync(a,b);},
  getFileInfo:a=>respond(a,()=>{const b=fs.readFileSync(a.filePath);return{size:b.length,digest:hash(b)};}),
  unlink:a=>respond(a,()=>fs.unlinkSync(a.filePath)),
  rmdir:a=>respond(a,()=>fs.rmSync(a.dirPath,{recursive:true})),
  unzip:a=>respond(a,()=>execFileSync('unzip',['-q',a.zipFilePath,'-d',a.targetPath]))
 };
 const api={env:{USER_DATA_PATH:root},getFileSystemManager:()=>fsm,downloadFile(a){downloads++;setImmediate(()=>{
  if(fail){a.fail({errMsg:'offline'});return;}
  const tempFilePath=path.join(root,'temp-'+downloads);fs.writeFileSync(tempFilePath,badBody?'wrong zip':bytes);a.success({statusCode:200,tempFilePath,header:{'content-type':'application/zip'}});
 });return{onProgressUpdate(){},abort(){}};}};
 const create=()=>require('../miniprogram/services/audio-bundle-service').createAudioBundleService(api,descriptor,assets,'https://example.test');
 return{root,assets,create,downloads:()=>downloads,setFail:v=>fail=v,setBad:v=>badBody=v,setCommitFail:v=>failCommit=v};
}

test('one bundle installs all 145 files and survives offline restart without FIFO eviction',async t=>{
 const f=fixture(t),service=f.create();
 assert.equal((await service.inspect()).ready,false);
 assert.equal(await service.acquire(f.assets[0]),null);
 assert.equal(f.downloads(),0);
 await Promise.all([service.install(),service.install()]);assert.equal(f.downloads(),1);
 f.setFail(true);const restart=f.create();assert.equal((await restart.inspect()).ready,true);
 for(const a of f.assets){const lease=await restart.acquire(a);assert.ok(lease);assert.equal(hash(fs.readFileSync(lease.path)),a.sha1);lease.release();}
 assert.equal(f.downloads(),1);
});

test('bad archive or interrupted activation preserves installed audio; corrupt files require repair',async t=>{
 const f=fixture(t),service=f.create();await service.install();
 f.setBad(true);await assert.rejects(service.install(),/校验/);
 let lease=await service.acquire(f.assets[0]);assert.ok(lease);lease.release();
 f.setBad(false);f.setCommitFail(true);await assert.rejects(service.install(),/disk full/);
 lease=await f.create().acquire(f.assets[0]);assert.ok(lease);lease.release();
 fs.writeFileSync(lease.path,'corrupt');assert.equal(await service.acquire(f.assets[0]),null);
 assert.equal((await service.inspect()).ready,false);
 f.setCommitFail(false);await service.install();assert.equal((await service.inspect()).ready,true);
});

test('clearing installed files respects active playback and does not touch learning data',async t=>{
 const f=fixture(t),service=f.create();fs.writeFileSync(path.join(f.root,'learning.json'),'keep');
 await service.install();const lease=await service.acquire(f.assets[0]);
 await assert.rejects(service.clear(),/播放/);lease.release();await service.clear();
 assert.equal(await service.acquire(f.assets[0]),null);assert.equal(fs.readFileSync(path.join(f.root,'learning.json'),'utf8'),'keep');
});

test('cancellation and offline retries never activate an incomplete installation',async t=>{
 const f=fixture(t),service=f.create();
 const job=service.install();service.cancel();await assert.rejects(job,/取消/);
 assert.equal((await service.inspect()).ready,false);
 f.setFail(true);await assert.rejects(service.install(),/offline/);
 f.setFail(false);await service.install();assert.equal((await service.inspect()).ready,true);
});
