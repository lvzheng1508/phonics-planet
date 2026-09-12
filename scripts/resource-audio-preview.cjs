// Browser development only: preserve production audio provenance, adapt media URLs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createUrlProvider}=require('../miniprogram/services/resource-service');
function createResourcePreview(data,{directory,baseUrl}) {
  const provider=createUrlProvider(baseUrl);
  const assets=new Map(data.audio.filter(a=>String(a.src).startsWith('resource://')).map(a=>[a.id,a]));
  const preview=structuredClone(data);
  preview.audio=preview.audio.map(a=>{
    if(!assets.has(a.id)) return a;
    const url=provider(a); // Validate descriptor path before mapping either mode.
    return {...a,src:directory?'/resource-audio/'+a.id+'.'+a.extension:url};
  });
  return {data:preview,readAudio(id){
    if(!directory) throw Error('No local resource directory configured');
    const asset=assets.get(id);
    if(!asset) throw Error('Resource audio not found');
    provider(asset);
    const root=fs.realpathSync(directory);
    const file=fs.realpathSync(path.join(root,asset.src.slice('resource://'.length)));
    if(!file.startsWith(root+path.sep)) throw Error('Resource path outside directory');
    const bytes=fs.readFileSync(file);
    if(bytes.length!==asset.bytes||crypto.createHash('sha1').update(bytes).digest('hex')!==asset.sha1) throw Error('Resource audio integrity check failed');
    return bytes;
  }};
}
module.exports={createResourcePreview};
