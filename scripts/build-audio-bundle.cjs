// Build only currently referenced, licensed audio. Requires the system zip tool.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {isResourceDescriptor}=require('../miniprogram/services/resource-service');
const root=path.resolve(__dirname,'..');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const resource=arg('--resource',null);if(!resource)throw Error('Specify --resource /path/to/resource');
const output=path.resolve(arg('--output',resource));
const manifest=JSON.parse(fs.readFileSync(arg('--manifest',path.join(root,'seed-data/audio-manifest.json')),'utf8'));
const assets=manifest.filter(a=>a.src&&a.src.startsWith('resource://')).sort((a,b)=>a.id.localeCompare(b.id,'en'));
if(!assets.length)throw Error('No current audio');
const staging=fs.mkdtempSync(path.join(os.tmpdir(),'phonics-audio-zip-'));
const sha=b=>crypto.createHash('sha1').update(b).digest('hex');
try{
 const names=new Set();let unpackedBytes=0;
 for(const a of assets){
  if(!isResourceDescriptor(a)||!a.source||!a.license)throw Error('Invalid audio descriptor: '+a.id);
  const relative=a.src.slice(11);
  if(relative.split('/').some(s=>!s||s==='.'||s==='..'||!/^[a-zA-Z0-9_.-]+$/.test(s)))throw Error('Invalid resource path');
  const bytes=fs.readFileSync(path.join(resource,relative));
  if(bytes.length!==a.bytes||sha(bytes)!==a.sha1)throw Error('资源校验失败: '+a.id);
  const name=a.sha1+'.'+a.extension;
  if(!names.has(name)){fs.writeFileSync(path.join(staging,name),bytes);names.add(name);unpackedBytes+=bytes.length;}
 }
 fs.writeFileSync(path.join(staging,'SOURCES.json'),JSON.stringify({notice:'AI 合成试听 · 待发音核对。仅包含当前应用清单；不包含历史音色或缺失音素。',assets},null,2)+'\n');
 names.add('SOURCES.json');
 const sorted=[...names].sort();
 for(const name of sorted)fs.utimesSync(path.join(staging,name),new Date('2020-01-01T00:00:00Z'),new Date('2020-01-01T00:00:00Z'));
 execFileSync('zip',['-X','-q',path.join(staging,'audio.zip'),...sorted],{cwd:staging,env:{...process.env,TZ:'UTC'}});
 const archive=fs.readFileSync(path.join(staging,'audio.zip')),digest=sha(archive);
 const relative='bundles/audio/words-'+digest.slice(0,16)+'.zip';
 const assetsSha256=crypto.createHash('sha256').update(JSON.stringify(assets)).digest('hex');
 const descriptor={version:digest,src:'resource://'+relative,sha1:digest,bytes:archive.length,fileCount:names.size-1,unpackedBytes,assetsSha256};
 fs.mkdirSync(path.dirname(path.join(output,relative)),{recursive:true});fs.writeFileSync(path.join(output,relative),archive);
 fs.writeFileSync(arg('--descriptor',path.join(root,'seed-data/audio-bundle.json')),JSON.stringify(descriptor,null,2)+'\n');
 console.log(JSON.stringify(descriptor,null,2));
}finally{fs.rmSync(staging,{recursive:true,force:true});}
