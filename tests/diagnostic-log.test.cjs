const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createLogger} = require('../miniprogram/services/diagnostic-log');
test('diagnostic history survives restart, bounds entries and redacts URL secrets', () => {
  let saved;
  const storage = {get:()=>saved,set:v=>{saved=JSON.parse(JSON.stringify(v));}};
  const log = createLogger(storage);
  for (let i=0;i<110;i++) log.record('download', {i,url:'https://example.test/a?token=SECRET',authorization:'PRIVATE'});
  log.record('failure', new Error('native failed'));
  const restart = createLogger(storage);
  assert.equal(restart.list().length,100);
  assert.match(restart.export(),/native failed/);
  assert.doesNotMatch(restart.export(),/SECRET|PRIVATE/);
  restart.clear();
  assert.equal(createLogger(storage).list().length,0);
});
test('storage errors and circular diagnostics cannot break the application', () => {
  const log=createLogger({get:()=>{throw Error('read');},set:()=>{throw Error('full');}});
  const value={};value.self=value;
  assert.doesNotThrow(()=>log.record('error',value));
  assert.equal(log.status(),false);
  assert.match(log.export(),/circular/);
});
test('repeated restarts preserve readable diagnostics without exponential escaping',()=>{
 let saved;
 const storage={get:()=>saved,set:v=>{saved=JSON.parse(JSON.stringify(v));}};
 const original=createLogger(storage);original.record('download.error',{error:'url not in domain list',url:'https://example.test/a?token=private'});
 const detail=original.list()[0].detail;
 for(let i=0;i<12;i++){
  const next=createLogger(storage);assert.equal(next.list()[0].detail,detail);next.record('restart',{i});
 }
 // Recover old logs which were serialized an extra time, without restoring secrets.
 saved=[{time:'2026-09-12',event:'old',detail:JSON.stringify(JSON.stringify({url:'https://example.test/a?token=private',token:'private'}))}];
 const restored=createLogger(storage).list()[0].detail;
 assert.equal(JSON.parse(restored).url,'https://example.test/a');assert.doesNotMatch(restored,/private/);
});
