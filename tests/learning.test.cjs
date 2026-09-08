const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStorageService } = require('../miniprogram/services/storage-service');
const { createContentService } = require('../miniprogram/services/content-service');
const base = require('../miniprogram/data/generated');

function fixture(date = '2026-09-08T12:00:00+08:00') {
  const db = {}; let current = new Date(date); let fail = false;
  const api = { getStorageSync: key => db[key], setStorageSync(key, value) { if (fail) throw Error('quota'); db[key] = JSON.parse(JSON.stringify(value)); } };
  const storage = createStorageService(api, { words: base.words, now: () => current });
  return { storage, db, api, clock: value => { current = new Date(value); }, fail: () => { fail = true; } };
}

test('custom word adds once, persists and canonical spelling reuses built-in word', () => {
  const f = fixture();
  assert.equal(typeof f.storage.addWord, 'function');
  assert.equal(f.storage.addWord('  Moon  ', '月亮').id, 'word_moon');
  const custom = f.storage.addWord('  Starfish  ', '海星');
  assert.equal(custom.word, 'starfish');
  assert.equal(custom.enrichmentStatus, 'pending');
  assert.equal(f.storage.addWord('STARFISH', '海星').id, custom.id);
  assert.equal(f.storage.snapshot().customWords.length, 1);
  assert.deepEqual(createStorageService(f.api, { words: base.words }).favorites(), ['word_moon', custom.id]);
  assert.throws(() => f.storage.addWord('<script>', 'bad'));
  assert.throws(() => f.storage.addWord('valid', ''));
});

test('failed atomic save leaves custom word, favorite and review state unchanged', () => {
  const f = fixture(); assert.equal(typeof f.storage.snapshot, 'function');
  const before = f.storage.snapshot(); f.fail();
  assert.throws(() => f.storage.addWord('starfish', '海星'), /quota/);
  assert.deepEqual(f.storage.snapshot(), before);
});

test('unreadable storage can render fallback but never overwrite saved user data', () => {
  const f = fixture();
  f.storage.addWord('starfish', '海星');
  f.storage.review('custom_starfish', 'known', 's:0');
  const before = JSON.stringify(f.db);
  f.api.getStorageSync = () => { throw Error('read failed'); };
  assert.deepEqual(f.storage.snapshot().customWords, []);
  assert.throws(() => f.storage.recordVisit('word_moon'), /读取/);
  assert.equal(JSON.stringify(f.db), before);
});

test('legacy favorites migrate on write without deleting old data; malformed sections recover', () => {
  const f = fixture(); f.db['phonics-planet:collections:v1'] = ['word_moon', 'word_moon', null];
  assert.deepEqual(f.storage.favorites(), ['word_moon']);
  assert.equal(typeof f.storage.recordVisit, 'function');
  f.storage.recordVisit('word_moon');
  assert.deepEqual(f.db['phonics-planet:collections:v1'], ['word_moon','word_moon',null]);
  f.db['phonics-planet:user:v2'].reviews = { word_moon: { box: 'oops', dueAt: 'bad' } };
  assert.deepEqual(f.storage.snapshot().reviews, {});
});

test('review progression uses calendar days, repeated token is idempotent and forgotten resets', () => {
  const f = fixture(); assert.equal(typeof f.storage.review, 'function');
  assert.equal(f.storage.review('word_moon','known','s:0').dueAt, '2026-09-09');
  assert.equal(f.storage.review('word_moon','known','s:0').box, 1);
  f.clock('2026-09-09T12:00:00+08:00');
  assert.equal(f.storage.review('word_moon','known','s:1').dueAt, '2026-09-12');
  assert.equal(f.storage.review('word_moon','again','s:2').dueAt, '2026-09-10');
  assert.equal(f.storage.snapshot().reviews.word_moon.box, 0);
  assert.throws(() => f.storage.review('word_moon','invalid','s:3'));
});

test('today derives actual visits and due favorites, selected unit controls new words', () => {
  const { createLearningService } = require('../miniprogram/services/learning-service');
  const f = fixture(); const content = createContentService(base, f.storage);
  const learning = createLearningService(content, f.storage);
  f.storage.setSelection('pep_2026_g6_s1','unit_5');
  f.storage.toggle('word_moon'); f.storage.recordVisit('word_moon'); f.storage.recordVisit('word_moon');
  const today = learning.today();
  assert.equal(today.visitedCount, 1); assert.equal(today.reviewedCount, 0);
  assert.ok(today.newWords.some(w => w.id === 'word_planet'));
  assert.deepEqual(learning.reviewQueue().map(w => w.id), ['word_moon']);
  f.storage.review('word_moon','known','s:0');
  assert.equal(learning.reviewQueue().length, 0);
  f.clock('2026-09-09T12:00:00+08:00');
  assert.equal(learning.today().visitedCount, 0);
  assert.equal(learning.reviewQueue().length, 1);
});

test('content detail keeps curriculum meaning; search includes custom words and malformed ID is safe', () => {
  const f=fixture(); assert.equal(typeof createContentService,'function');
  const content=createContentService(base,f.storage);
  const d=content.detail('word_run',{curriculumId:'pep_2026_g6_s1',unitId:'unit_6'});
  assert.equal(d.contextMeaning,'使运行');
  assert.equal(content.detail('word_run',{curriculumId:'bad',unitId:'unit_6'}).contextMeaning,'');
  f.storage.addWord('starfish','海星');
  assert.equal(content.words('海星')[0].word,'starfish');
  assert.equal(content.detail('missing'),null);
  assert.equal(content.detail('word_climb').pronunciationReady,false);
});

test('practice excludes unreviewed content and cannot invent missing distractors', () => {
  const { createPracticeService } = require('../miniprogram/services/practice-service');
  const f=fixture(), content=createContentService(base,f.storage);
  assert.deepEqual(createPracticeService(content).createSession('listen-word',[],1),[]);
  assert.deepEqual(createPracticeService(content).createSession('word-ipa',[],1),[]);
});

test('practice has unique answer labels and no homophone distractors in listening', () => {
  const { createPracticeService } = require('../miniprogram/services/practice-service');
  const words=[['see','siː'],['sea','siː'],['moon','muːn'],['dry','draɪ'],['clay','kleɪ']].map(([word,ipa])=>({id:'w_'+word,word,ipa,enrichmentStatus:'verified',phonemes:[],audioId:word}));
  const service=createPracticeService({words:()=>words,audioReady:()=>true,phoneme:()=>null});
  const qs=service.createSession('listen-word',[],22);
  assert.ok(qs.length>0);
  for(const q of qs){ assert.equal(new Set(q.options.map(x=>x.label)).size,q.options.length); assert.equal(q.options.filter(x=>x.id===q.answerId).length,1); if(q.wordId==='w_see')assert.ok(!q.options.some(x=>x.id==='w_sea')); }
  assert.deepEqual(qs,service.createSession('listen-word',[],22));
});

test('answer counters reject duplicate session tokens',()=>{
  const f=fixture(); assert.equal(typeof f.storage.recordAnswer,'function');
  f.storage.recordAnswer('q1',true,'p:0');f.storage.recordAnswer('q1',true,'p:0');
  assert.equal(f.storage.snapshot().days['2026-09-08'].answers.length,1);
});

test('same-sound questions have one matching vowel and omit ambiguous pronunciations',()=>{
  const {createPracticeService}=require('../miniprogram/services/practice-service');
  const words=[['moon','u'],['food','u'],['sky','ai'],['dry','ai'],['clay','ei']].map(([word,sound])=>({id:word,word,ipa:word,phonemes:[sound],enrichmentStatus:'verified'}));
  words.push({id:'read',word:'read',ipa:'riːd',phonemes:['i'],enrichmentStatus:'verified',pronunciations:[{id:'present'},{id:'past'}]});
  const service=createPracticeService({words:()=>words,phoneme:id=>({id,category:'vowel'})});
  const qs=service.createSession('same-sound',[],1);assert.ok(qs.length>0);
  for(const q of qs){
    assert.notEqual(q.wordId,'read');
    const target=words.find(w=>w.id===q.wordId).phonemes[0];
    assert.equal(q.options.filter(o=>words.find(w=>w.id===o.id).phonemes[0]===target).length,1);
    assert.ok(!q.options.some(o=>o.id==='read'));
  }
});
