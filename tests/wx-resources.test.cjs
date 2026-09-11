const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { createWxResourceAdapter } = require('../miniprogram/services/wx-resource-adapter');
const { createResourceCache } = require('../miniprogram/services/resource-service');

// Real files and HTTP. Only the WeChat callback boundary is emulated in Node.
function nodeWx(root) {
  const respond = (args, operation) => { try { args.success?.(operation()); } catch (error) { args.fail?.({ errMsg: error.message }); } };
  const fsm = {
    accessSync: fs.accessSync, mkdirSync: p => fs.mkdirSync(p, { recursive: true }),
    readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, readdirSync: fs.readdirSync,
    getFileInfo: a => respond(a, () => ({ size: fs.statSync(a.filePath).size, digest: crypto.createHash(a.digestAlgorithm).update(fs.readFileSync(a.filePath)).digest('hex') })),
    saveFile: a => respond(a, () => { fs.renameSync(a.tempFilePath, a.filePath); return { savedFilePath: a.filePath }; }),
    unlink: a => respond(a, () => fs.unlinkSync(a.filePath))
  };
  return { env: { USER_DATA_PATH: root }, getFileSystemManager: () => fsm, downloadFile: async a => {
    try {
      const response = await fetch(a.url);
      const tempFilePath = path.join(root, 'download-' + crypto.randomUUID());
      fs.writeFileSync(tempFilePath, Buffer.from(await response.arrayBuffer()));
      a.success({ statusCode: response.status, tempFilePath });
    } catch (error) { a.fail({ errMsg: error.message }); }
  } };
}
test('WeChat adapter stores real downloaded bytes, restarts offline, and rejects HTML/HTTP errors', async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'phonics-resource-test-'));
  const payload=Buffer.from('RIFF tiny audio transport fixture');
  const sha1=crypto.createHash('sha1').update(payload).digest('hex');
  const server=http.createServer((req,res)=>{
    res.statusCode=req.url==='/missing'?404:200;
    res.end(req.url==='/audio'?payload:'<html>login required</html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.close();fs.rmSync(root,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const api=nodeWx(root);
  const asset={src:'resource://audio/test.wav',sha1,bytes:payload.length,extension:'wav'};
  const create=endpoint=>createResourceCache(createWxResourceAdapter(api,'audio-v1'),()=>base+endpoint);
  const cache=create('/audio'),a=await cache.acquire(asset);a.release();
  assert.deepEqual(fs.readFileSync(a.path),payload);
  const restart=create('/missing'),b=await restart.acquire(asset);b.release();
  assert.equal(restart.stats().downloads,0);
  await restart.clear();
  await assert.rejects(create('/html').acquire(asset),/校验/);
  await assert.rejects(create('/missing').acquire(asset),/HTTP 404/);
  assert.equal(createWxResourceAdapter(api,'audio-v1').list().length,0);
});

test('corrupted index cannot reference or delete files outside the resource cache', async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'phonics-resource-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const outside=path.join(root,'learning-data.json');fs.writeFileSync(outside,'preserve');
  const adapter=createWxResourceAdapter(nodeWx(root),'audio-v1');
  adapter.writeIndex([{key:'1'.repeat(40)+'.mp3',sha1:'1'.repeat(40),extension:'mp3',bytes:8,path:outside}]);
  const cache=createResourceCache(adapter,()=>'',{});
  await cache.clear();
  assert.equal(fs.readFileSync(outside,'utf8'),'preserve');
});

test('does not unlink a WeChat temporary path after saveFile takes ownership', async () => {
  const sha1 = 'a'.repeat(40);
  const root = 'wxfile://usr';
  const tempFilePath = 'wxfile://tmp_download_result.html';
  const savedFilePath = root + '/resources-audio-v1/' + sha1 + '.mp3';
  const unlinkCalls = [];
  const respond = (args, value) => args.success(value);
  const api = {
    env: { USER_DATA_PATH: root },
    getFileSystemManager: () => ({
      accessSync() {}, mkdirSync() {},
      readFileSync() { throw Error('no index'); },
      writeFileSync() {}, renameSync() {}, readdirSync() { return []; },
      getFileInfo(args) { respond(args, { size: 7, digest: sha1 }); },
      saveFile(args) { respond(args, { savedFilePath }); },
      unlink(args) { unlinkCalls.push(args.filePath); args.fail({ errMsg: 'unlink:fail permission denied' }); }
    }),
    downloadFile(args) { args.success({ statusCode: 200, tempFilePath }); }
  };
  const adapter = createWxResourceAdapter(api, 'audio-v1');
  const cache = createResourceCache(adapter, () => 'https://example.test/i.mp3');
  const lease = await cache.acquire({ src: 'resource://audio/i.mp3', sha1, bytes: 7, extension: 'mp3' });

  assert.equal(lease.path, savedFilePath);
  assert.deepEqual(unlinkCalls, []);
});

test('temporary cleanup denial cannot mask rejected content or file inspection errors', async () => {
  for (const inspectionFails of [false, true]) {
    const cache = createResourceCache({
      readIndex: () => [], list: () => [],
      download: async () => 'wxfile://tmp_response.html',
      info: async () => {
        if (inspectionFails) throw Error('getFileInfo:fail permission denied');
        return { size: 500, digest: 'b'.repeat(40) };
      },
      remove: async () => { throw Error('unlink:fail permission denied'); },
      save: async () => { assert.fail('invalid download must never be saved'); }
    }, () => 'https://example.test/i.mp3');
    await assert.rejects(cache.acquire({src:'resource://audio/i.mp3',sha1:'a'.repeat(40),bytes:7,extension:'mp3'}),
      inspectionFails ? /getFileInfo:fail/ : /资源校验失败/);
    assert.equal(cache.stats().count, 0);
  }
});
