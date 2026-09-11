const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createResourceCache, createUrlProvider } = require('../miniprogram/services/resource-service');
test('resource descriptors require bytes and digest before a release can build',()=>{
  const {isResourceDescriptor}=require('../miniprogram/services/resource-service');
  assert.equal(isResourceDescriptor({src:'resource://audio/i.mp3',sha1:'1'.repeat(40),bytes:12,extension:'mp3'}),true);
  assert.equal(isResourceDescriptor({src:'resource://audio/i.mp3',sha1:'bad',bytes:12,extension:'mp3'}),false);
  assert.equal(isResourceDescriptor({src:'resource://audio/i.mp3',sha1:'1'.repeat(40),bytes:0,extension:'mp3'}),false);
});
function fixture() {
  let index = []; let calls = 0;
  const files = new Map();
  const adapter = {
    readIndex: () => structuredClone(index), writeIndex: value => { index = structuredClone(value); },
    list: () => [...files.keys()],
    info: async path => { if (!files.has(path)) throw Error('missing'); return files.get(path); },
    download: async url => { calls++; const path = 'tmp' + calls; files.set(path, { size: 4, digest: url.includes('bad') ? 'bad' : url.split('/').pop() }); return path; },
    save: async (temp, name) => { files.set(name, files.get(temp)); files.delete(temp); return name; },
    remove: async path => { files.delete(path); }
  };
  const asset = n => ({ src: 'resource://audio/' + n, sha1: String(n).repeat(40), bytes: 4, extension: 'mp3' });
  const provider = a => 'https://example.test/' + (a.bad ? 'bad' : a.sha1);
  const cache = options => createResourceCache(adapter, provider, { maxFiles: 2, maxBytes: 8, ...options });
  return { adapter, asset, cache, files, calls: () => calls };
}
test('concurrent requests reuse one download; persisted cache survives restart and works offline', async () => {
  const f = fixture(), cache = f.cache();
  const [a,b] = await Promise.all([cache.acquire(f.asset(1)), cache.acquire(f.asset(1))]);
  assert.equal(a.path,b.path); assert.equal(f.calls(),1); a.release(); b.release();
  f.adapter.download = async () => { throw Error('offline'); };
  const c = await f.cache().acquire(f.asset(1)); assert.equal(c.path,a.path); c.release();
});
test('FIFO does not refresh age on a hit; pinned playback files are not evicted', async () => {
  const f=fixture(),c=f.cache();
  const a=await c.acquire(f.asset(1)); a.release();
  const b=await c.acquire(f.asset(2)); b.release();
  const hit=await c.acquire(f.asset(1)); hit.release();
  const d=await c.acquire(f.asset(3)); d.release();
  assert.equal(c.stats().entries.some(x=>x.sha1===f.asset(1).sha1),false);
  const pin=await c.acquire(f.asset(2));
  const e=await c.acquire(f.asset(4));
  assert.equal(c.stats().entries.some(x=>x.sha1===f.asset(2).sha1),true);
  await assert.rejects(c.acquire(f.asset(5)), /使用中/);
  pin.release(); e.release();
});
test('byte budget, corrupt response, removed local file and failed download do not poison cache', async () => {
  const f=fixture(),c=f.cache({maxFiles:100,maxBytes:4});
  await assert.rejects(c.acquire({...f.asset(1),bytes:5}), /容量/);
  await assert.rejects(c.acquire({...f.asset(1),bad:true}), /校验/);
  assert.equal(c.stats().count,0); assert.equal(f.files.size,0);
  const a=await c.acquire(f.asset(1)); a.release(); f.files.delete(a.path);
  const b=await c.acquire(f.asset(1)); b.release(); assert.equal(f.calls(),3);
  const d=await c.acquire(f.asset(2)); d.release(); assert.equal(c.stats().bytes,4);
  f.adapter.download=async()=>{throw Error('offline');};
  await assert.rejects(c.acquire(f.asset(3)),/offline/);
  assert.equal(c.stats().count,1);
});
test('changed resource version downloads new bytes; provider switch leaves cache identity stable', async () => {
  const f=fixture(),c=f.cache(); const a=await c.acquire(f.asset(1));a.release();
  const changed=await c.acquire({...f.asset(1),sha1:f.asset(2).sha1});changed.release();
  assert.equal(f.calls(),2);
  const url=createUrlProvider('https://gitee.com/me/resource/raw/master/');
  assert.equal(url({src:'resource://audio/en-GB/moon.v1.mp3'}),'https://gitee.com/me/resource/raw/master/audio/en-GB/moon.v1.mp3');
  assert.throws(()=>url({src:'resource://../private'}));
});
