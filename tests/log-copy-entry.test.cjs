const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('copying a failure copies that complete record without unrelated history',()=>{
 let page,clipboard;
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/logs/index.js'),'utf8'),{Page:p=>page=p,require:()=>({}),wx:{setClipboardData:p=>{clipboard=p.data;}}});
 const entry={time:'2026-09-12T12:00:00Z',event:'resource.error',detail:JSON.stringify({id:'word_was',requestUrl:'https://example.test/was.mp3',statusCode:200,contentType:'text/html',responseSummary:'Sign in',error:{message:'网页而非音频'}})};
 page.data={entries:[{event:'unrelated',detail:'omit'},entry]};
 page.copyEntry({currentTarget:{dataset:{index:1}}});
 assert.match(clipboard,/word_was/);assert.match(clipboard,/https:\/\/example.test\/was.mp3/);assert.match(clipboard,/Sign in/);assert.doesNotMatch(clipboard,/omit/);
 const previous=clipboard;page.copyEntry({currentTarget:{dataset:{index:999}}});assert.equal(clipboard,previous);
 entry.event='bundle.error';entry.detail=JSON.stringify({requestUrl:'https://example.test/audio.zip',stage:'extract',error:{message:'disk full'}});
 page.copyEntry({currentTarget:{dataset:{index:1}}});assert.match(clipboard,/audio.zip/);assert.match(clipboard,/disk full/);
});
