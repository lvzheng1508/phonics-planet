const log = require('./diagnostic-log');
const {createUrlProvider, isResourceDescriptor} = require('./resource-service');
const {createWxResourceAdapter} = require('./wx-resource-adapter');

// Installed bundles are durable resources, independent of the legacy FIFO cache.
function createAudioBundleService(api, descriptor, assets, baseUrl) {
  const fs = api.getFileSystemManager();
  const root = api.env.USER_DATA_PATH + '/audio-bundles-v1';
  const transport = createWxResourceAdapter(api, 'bundle-downloads-v1');
  const files = Array.from(new Map(assets.map(a => [a.sha1 + '.' + a.extension, a])).values());
  const directoryName = /^install-[a-f0-9]{40}-[0-9]+$/;
  const listeners = new Set(), pins = new Map();
  let active = null, flight = null, task = null, cancelled = false, sequence = 0;
  let state = {status:'idle', progress:0, error:'', ready:false, count:0, total:files.length, bytes:descriptor.bytes};
  try { fs.accessSync(root); } catch (_) { fs.mkdirSync(root, true); }
  try {
    const saved = JSON.parse(fs.readFileSync(root + '/active.json', 'utf8'));
    if (saved && directoryName.test(saved.directory) && /^[a-f0-9]{40}$/.test(saved.sha1)) active = saved;
  } catch (_) {}
  const emit = patch => { state = {...state, ...patch}; for (const fn of listeners) fn({...state}); };
  const call = (method,args) => new Promise((resolve,reject) => fs[method]({...args,success:resolve,fail:e=>reject(Error(e.errMsg || '本地文件操作失败'))}));
  const info = path => call('getFileInfo',{filePath:path,digestAlgorithm:'sha1'});
  const pathOf = (installation,a) => root + '/' + installation.directory + '/' + a.sha1 + '.' + a.extension;
  async function validFile(installation,a) {
    if (!installation || !isResourceDescriptor(a)) return false;
    try {const r=await info(pathOf(installation,a));return r.size===a.bytes && r.digest===a.sha1;} catch (_) {return false;}
  }
  function pin(directory) {
    pins.set(directory,(pins.get(directory)||0)+1);
    let released=false;
    return () => {if(released)return;released=true;const n=pins.get(directory)-1;if(n)pins.set(directory,n);else pins.delete(directory);};
  }
  async function acquire(a) {
    const installation=active;
    if (!installation) return null;
    const release=pin(installation.directory);
    if (!await validFile(installation,a)) {release();return null;}
    log.record('bundle.hit',{id:a.id,key:a.sha1+'.'+a.extension});
    return {path:pathOf(installation,a),cached:true,release};
  }
  async function inspect() {
    const installation=active;
    const release=installation?pin(installation.directory):()=>{};
    let count=0;
    try {for(const a of files)if(await validFile(installation,a))count++;}finally{release();}
    if(active!==installation)return inspect();
    const ready=count===files.length && files.length>0;
    // Do not overwrite installation progress when revisiting the download page.
    emit({ready,count,...(!flight?{status:ready?'ready':'idle'}:{})});
    return {...state};
  }
  const checkCancelled = () => {if(cancelled)throw Object.assign(Error('已取消下载'),{code:'BUNDLE_CANCELLED'});};
  async function removeDirectory(name) {
    if (!directoryName.test(name) || pins.has(name)) return;
    await call('rmdir',{dirPath:root+'/'+name,recursive:true});
  }
  async function cleanup() {
    for(const name of fs.readdirSync(root)) {
      if(directoryName.test(name) && (!active || name!==active.directory) && !pins.has(name)) {
        try {await removeDirectory(name);}catch(error){log.record('bundle.cleanup.error',{error});}
      }
    }
  }
  async function runInstall() {
    let temporary, staging;
    const diagnostic={requestUrl:null,stage:'prepare',statusCode:null,contentType:null,expectedBytes:descriptor.bytes,expectedSha1:descriptor.sha1};
    try {
      if (!/^[a-f0-9]{40}$/.test(descriptor.sha1) || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes<=0 || !files.length || files.some(a=>!isResourceDescriptor(a)) || files.length!==descriptor.fileCount) throw Error('音频包清单无效');
      await cleanup();checkCancelled();
      diagnostic.requestUrl=createUrlProvider(baseUrl)(descriptor);
      emit({status:'downloading',progress:0,error:''});diagnostic.stage='download';
      temporary=await transport.download(diagnostic.requestUrl,diagnostic,{timeout:120000,onTask:t=>{task=t;},onProgress:p=>{if(!cancelled)emit({progress:p.progress});}});
      checkCancelled();emit({status:'verifying',progress:100});diagnostic.stage='validate-archive';
      const archive=await transport.info(temporary);diagnostic.actualBytes=archive.size;diagnostic.actualSha1=archive.digest;
      if(archive.size!==descriptor.bytes || archive.digest!==descriptor.sha1)throw Error('音频包校验失败，请重试');
      staging='install-'+descriptor.sha1+'-'+(Date.now()*1000+(++sequence));
      const directory=root+'/'+staging;fs.mkdirSync(directory,true);
      emit({status:'extracting'});diagnostic.stage='extract';
      // Only archives matching our published digest are ever extracted.
      await call('unzip',{zipFilePath:temporary,targetPath:directory});checkCancelled();
      diagnostic.stage='validate-files';
      for(const a of files){checkCancelled();if(!await validFile({directory:staging},a))throw Error('解压后的音频不完整，请重试');}
      checkCancelled();diagnostic.stage='activate';
      const next={directory:staging,sha1:descriptor.sha1};
      fs.writeFileSync(root+'/active.tmp',JSON.stringify(next),'utf8');
      fs.renameSync(root+'/active.tmp',root+'/active.json');
      active=next;staging=null;
      emit({status:'ready',ready:true,count:files.length,progress:100,error:''});
      log.record('bundle.installed',{sha1:descriptor.sha1,count:files.length,bytes:descriptor.unpackedBytes});
      await cleanup();
    } catch(error) {
      emit({status:cancelled?'idle':'error',error:cancelled?'已取消下载':'音频包暂时无法下载或安装，请稍后再试'});
      log.record('bundle.error',{...diagnostic,error:{code:error.code||null,message:error.message}});
      throw error;
    } finally {
      task=null;
      if(staging)try{await removeDirectory(staging);}catch(error){log.record('bundle.cleanup.error',{error});}
      if(temporary)try{await transport.remove(temporary);}catch(error){log.record('bundle.cleanup.error',{error});}
    }
  }
  return {
    acquire,inspect,
    install(){if(flight)return flight;cancelled=false;flight=runInstall().finally(()=>{flight=null;});return flight;},
    cancel(){if(!flight)return;cancelled=true;if(task&&task.abort)task.abort();},
    state:()=>({...state}),
    subscribe(fn){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);},
    async clear(){
      if(flight)throw Error('请先等待音频安装结束');
      if(pins.size)throw Error('请先停止播放再清除音频');
      // Remove the active pointer before deleting any files. Learning storage is separate.
      fs.writeFileSync(root+'/active.tmp','null','utf8');fs.renameSync(root+'/active.tmp',root+'/active.json');active=null;
      await cleanup();emit({status:'idle',ready:false,count:0,progress:0,error:''});
    }
  };
}
let singleton;
function shared(){
  if(!singleton){const data=require('../data/generated');singleton=createAudioBundleService(wx,data.audioBundle,data.audio.filter(a=>a.src&&a.src.startsWith('resource://')),require('../resource-config').baseUrl);}
  return singleton;
}
module.exports={createAudioBundleService,acquire:a=>shared().acquire(a),inspect:()=>shared().inspect(),install:()=>shared().install(),cancel:()=>shared().cancel(),subscribe:fn=>shared().subscribe(fn),clear:()=>shared().clear()};
