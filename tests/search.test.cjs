const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createContentService}=require('../miniprogram/services/content-service');
const {createStorageService}=require('../miniprogram/services/storage-service');
const word=(id,text,meanings)=>({id,word:text,meanings,enrichmentStatus:'pending'});
function fixture(){
 const source={words:[word('outrun','outrun',['超过']),word('runner','runner',['跑步者']),word('meaning','operate',['run a machine']),word('run','run',['跑']),word('house','gingerbread house',['姜饼屋']),word('thousand','thousand',['一千'])],phonemes:[],audio:[],curriculums:[{id:'book',name:'测试教材',units:[{id:'one',name:'单元一',entries:[{wordId:'run',meaning:'跑步'}]},{id:'two',name:'单元二',entries:[{wordId:'run',meaning:'使运行'}]}]}]};
 const db={};const api={getStorageSync:k=>db[k],setStorageSync:(k,v)=>{db[k]=structuredClone(v);}};
 const storage=createStorageService(api,{words:source.words});
 return {content:createContentService(source,storage),storage,api,db};
}
function search(content,q,options){
 const mod=require('../miniprogram/services/search-service');
 return mod.createSearchService(content).search(q,options);
}
test('global search ranks exact, prefix, substring and meaning matches; suggestions keep full count',()=>{
 const {content}=fixture();const result=search(content,' RUN ',{limit:3});
 assert.equal(result.total,4);assert.deepEqual(result.items.map(x=>x.id),['run','runner','outrun']);
 assert.deepEqual(search(content,'run').items.map(x=>x.id),['run','runner','outrun','meaning']);
 assert.equal(search(content,'   ').total,0);
 assert.equal(search(content,'GINGERBREAD   HOUSE').items[0].id,'house');
});
test('search indexes context meanings, deduplicates shared words and opens matching unit context',()=>{
 const {content}=fixture();const item=search(content,'运行').items[0];
 assert.equal(item.id,'run');assert.equal(item.meaning,'使运行');
 assert.deepEqual(item.context,{curriculumId:'book',unitId:'two'});
 assert.equal(item.sources.length,2);assert.equal(search(content,'run').items.filter(x=>x.id==='run').length,1);
});
test('custom words appear after creation without recreating content; unsafe markup stays plain text',()=>{
 const {content,storage}=fixture();storage.addWord('star fish','海星 <新词>');
 const item=search(content,'海星').items[0];assert.equal(item.word,'star fish');assert.equal(item.custom,true);
 assert.equal(item.meaningParts.map(p=>p.text).join(''),'海星 <新词>');
 assert.equal(item.meaningParts[0].matched,true);
});
test('typo suggestions handle transposition and missing letters but never short, unrelated or Chinese queries',()=>{
 const {content}=fixture();
 assert.equal(search(content,'thousnad').corrections[0].word,'thousand');
 assert.equal(search(content,'gingerbread hous').total,1);
 assert.equal(search(content,'thousnd').corrections[0].word,'thousand');
 for(const q of ['rn','不存在','zzzzzzzz','run'])assert.deepEqual(search(content,q).corrections,[]);
});
test('search history is normalized, capped, persistent and clear does not change learning data',()=>{
 const {storage,api}=fixture();storage.toggle('run');storage.rememberSearch('  Gingerbread   House  ');storage.rememberSearch('gingerbread house');
 assert.deepEqual(storage.searchHistory(),['gingerbread house']);
 for(const q of ['one','two','three','four','five','six','seven','eight','nine'])storage.rememberSearch(q);
 assert.deepEqual(createStorageService(api).searchHistory(),['nine','eight','seven','six','five','four','three','two']);
 storage.rememberSearch(' ');assert.equal(storage.searchHistory().length,8);
 storage.clearSearchHistory();assert.deepEqual(storage.searchHistory(),[]);assert.deepEqual(storage.favorites(),['run']);
});
test('history tolerates corrupt records and read or write failures do not overwrite existing history',()=>{
 const {storage,api,db}=fixture();storage.rememberSearch('run');const key=Object.keys(db)[0];
 db[key]=['run',null,5,{},' RUN ','x'.repeat(81)];assert.deepEqual(storage.searchHistory(),['run']);
 const before=structuredClone(db);api.getStorageSync=()=>{throw Error('read failed');};
 assert.deepEqual(storage.searchHistory(),[]);assert.throws(()=>storage.rememberSearch('house'));assert.deepEqual(db,before);
 api.getStorageSync=k=>db[k];api.setStorageSync=()=>{throw Error('quota');};
 assert.throws(()=>storage.clearSearchHistory());assert.deepEqual(db,before);
});
