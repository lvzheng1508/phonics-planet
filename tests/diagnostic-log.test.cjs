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
