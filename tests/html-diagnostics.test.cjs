const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createWxResourceAdapter} = require('../miniprogram/services/wx-resource-adapter');
const log = require('../miniprogram/services/diagnostic-log');

test('HTML download logs bounded visible text, never reads normal audio, and tolerates read errors', async () => {
  for (const mode of ['html','audio','denied','script','empty']) {
    log.clear();
    const api = {
      env:{USER_DATA_PATH:'wxfile://usr'},
      getFileSystemManager:()=>({
        accessSync(){},
        getFileInfo(a){a.success({size:mode==='empty'?4:9000});},
        readFile(a){
          assert.notEqual(mode,'audio');
          if(mode==='empty') {
            if(a.encoding) return a.success({data:''});
            assert.equal(a.length,undefined);
            return a.success({data:new Uint8Array([60,104,116,62]).buffer});
          }
          assert.equal(a.length,4096);
          if(mode==='denied') return a.fail({errMsg:'readFile:fail permission denied'});
          if(mode==='script') return a.success({data:'<html><script>location.replace("https://example.test/login?token=PRIVATE");</script></html>'});
          a.success({data:'<title>Access denied</title><script>secret code</script><input value="private"><p>Try later</p>'+ 'x'.repeat(5000)});
        }
      }),
      downloadFile(a){a.success({statusCode:200,tempFilePath:'wxfile://tmp.'+(mode==='audio'?'mp3':'html'),header:{'Content-Type':[mode==='audio'?'audio/mpeg':'text/html; charset=gbk']}});}
    };
    await createWxResourceAdapter(api,'test').download('https://example.test/sample.mp3');
    const entries=log.list();
    if(mode==='html') {
      const detail=JSON.parse(entries.find(e=>e.event==='download.html').detail);
      assert.match(detail.text,/Access denied.*Try later/);
      assert.doesNotMatch(detail.text,/secret code|private|<script/);
      assert.ok(detail.text.length<=800);
      assert.equal(detail.truncated,true);
    } else if(mode==='empty') {
      const detail=JSON.parse(entries.find(e=>e.event==='download.html.bytes').detail);
      assert.equal(detail.hex,'3c68743e');
      assert.equal(detail.actualReadBytes,4);
    } else if(mode==='script') {
      const detail=JSON.parse(entries.find(e=>e.event==='download.html.source').detail);
      assert.match(detail.source,/location.replace/);
      assert.doesNotMatch(detail.source,/PRIVATE/);
      assert.ok(detail.source.length<=800);
    } else if(mode==='denied') assert.match(log.export(),/readFile:fail permission denied/);
    else assert.ok(!entries.some(e=>e.event.startsWith('download.html')));
  }
});
