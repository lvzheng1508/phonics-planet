const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
test('bundle builder includes only current manifest files and produces reproducible archive',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phonics-build-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const source=path.join(dir,'resource');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'a.mp3'),'current');fs.writeFileSync(path.join(source,'old.mp3'),'old');
 const sha1=crypto.createHash('sha1').update('current').digest('hex');
 const manifest=path.join(dir,'manifest.json');fs.writeFileSync(manifest,JSON.stringify([{id:'word_a',src:'resource://a.mp3',bytes:7,sha1,extension:'mp3',source:'test source',license:'test',status:'synthetic-preview'}]));
 const run=()=>execFileSync(process.execPath,['scripts/build-audio-bundle.cjs','--resource',source,'--output',path.join(dir,'out'),'--manifest',manifest,'--descriptor',path.join(dir,'bundle.json')],{stdio:'pipe'});
 run();const d=JSON.parse(fs.readFileSync(path.join(dir,'bundle.json')));const archive=path.join(dir,'out',d.src.slice(11));
 const original=fs.readFileSync(archive);run();assert.deepEqual(fs.readFileSync(archive),original);
 const entries=execFileSync('unzip',['-Z1',archive],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(entries.sort(),['SOURCES.json',sha1+'.mp3'].sort());
 assert.equal(d.fileCount,1);assert.equal(d.unpackedBytes,7);assert.equal(d.sha1,crypto.createHash('sha1').update(original).digest('hex'));
 fs.writeFileSync(path.join(source,'a.mp3'),'tampered');assert.throws(run,/校验/);
});
