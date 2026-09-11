const log = require('./diagnostic-log');
function createLoader({acquire,isBusy=()=>false,delay=1000,schedule=setTimeout,cancel=clearTimeout}) {
  let job=null,timer=null,running=false,foreground=true,nextAllowed=0;
  const listeners=new Set();
  const state=()=>job?{...job.stats}:{total:0,available:0,missing:0,ready:0,failed:0,status:'idle'};
  const emit=()=>{for(const fn of listeners)fn(state());};
  function arm(ms=delay){if(timer!==null)cancel(timer);timer=schedule(()=>{timer=null;tick();},ms);}
  async function tick(){
    if(running||!job||!foreground||job.stats.status==='paused')return;
    if(isBusy()||Date.now()<nextAllowed){arm();return;}
    const current=job,asset=current.assets.shift();
    if(!asset){current.stats.status='done';emit();return;}
    running=true;current.stats.status='loading';emit();
    try{const lease=await acquire(asset);lease.release();current.stats.ready++;current.streak=0;}
    catch(error){current.stats.failed++;current.streak++;log.record('prefetch.error',{id:asset.id,error});}
    finally{running=false;nextAllowed=Date.now()+delay;}
    if(job===current){if(current.streak>=3)current.stats.status='paused';emit();}
    if(job&&foreground&&job.stats.status!=='paused')arm();
  }
  return {
    start(key,assets,total){
      if(job&&job.key===key){emit();return;}
      const unique=Array.from(new Map(assets.map(a=>[a.sha1+'.'+a.extension,a])).values());
      job={key,assets:unique,streak:0,stats:{total,available:assets.length,missing:total-assets.length,ready:0,failed:0,status:unique.length?'waiting':'done'}};
      emit();arm();
    },
    foreground(value){foreground=value;if(!value&&timer!==null){cancel(timer);timer=null;}if(value)arm();},
    stop(){job=null;if(timer!==null)cancel(timer);timer=null;emit();},
    state,
    subscribe(fn){listeners.add(fn);fn(state());return()=>listeners.delete(fn);}
  };
}
let singleton;
function shared(){if(!singleton)singleton=createLoader({
  acquire:a=>require('./resource-service').acquire(a),
  isBusy:()=>['loading','playing'].includes(require('./audio-service').state().status)
});return singleton;}
module.exports={createLoader,
  start(curriculumId,unitId){const c=require('./content-service');const words=c.unitWords(curriculumId,unitId);
    const assets=words.map(w=>c.detail(w.id,{curriculumId,unitId})).filter(w=>w&&w.audioPlayable).map(w=>c.audio(w.audioId)).filter(a=>a&&String(a.src).startsWith('resource://'));
    shared().start(curriculumId+'/'+unitId,assets,words.length);
  },subscribe:fn=>shared().subscribe(fn),foreground:value=>shared().foreground(value)};
