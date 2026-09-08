const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const read = name => JSON.parse(fs.readFileSync(path.join(root,'seed-data',name),'utf8'));
const ps = read('phonemes.json'), ws = read('words.json'), audio = read('audio-manifest.json');
function unique(xs) { assert.equal(new Set(xs.map(x=>x.id)).size,xs.length,'Duplicate IDs'); }
[ps,ws,audio,read('graphemes.json')].forEach(unique);
assert.equal(ps.length,44); assert.equal(ps.filter(x=>x.category==='vowel').length,20); assert.equal(ps.filter(x=>x.category==='consonant').length,24);
const pids = new Set(ps.map(x=>x.id)), wids = new Set(ws.map(x=>x.id)), aids = new Set(audio.map(x=>x.id));
for(const p of ps) {assert.ok(p.symbol && p.exampleWord && p.commonSpellings.length);p.contrast.forEach(x=>assert.ok(pids.has(x)));assert.ok(aids.has(p.audioId));}
for(const g of read('graphemes.json')) g.phonemeIds.forEach(x=>assert.ok(pids.has(x)));
function validateWord(w) {
  assert.ok(w.id && w.word && Array.isArray(w.meanings) && w.meanings.length);
  assert.ok(['pending','verified'].includes(w.enrichmentStatus));
  assert.ok(aids.has(w.audioId)); w.phonemes.forEach(x=>assert.ok(pids.has(x)));
  w.segments.forEach(s=>s.phonemeIds.forEach(x=>assert.ok(pids.has(x))));
  if(w.segments.length) { assert.equal(w.segments.map(s=>s.grapheme).join(''),w.word); assert.deepEqual(w.segments.flatMap(s=>s.phonemeIds),w.phonemes); }
  if(w.enrichmentStatus==='verified') assert.ok(w.ipa && w.phonemes.length && w.segments.length && w.sourceIds.length && w.reviewer);
}
ws.forEach(validateWord);validateWord(read('examples/word-climb.json'));
const samples = read('learning-samples.json'); unique(samples);
const pronunciations = read('word-pronunciations.json');
assert.equal(new Set(pronunciations.map(p => p.wordId)).size, ws.length);
for (const p of pronunciations) {
  assert.ok(wids.has(p.wordId)); assert.equal(p.status, 'pending'); assert.equal(p.reviewer, null);
  assert.equal(p.displayTokens.map(t => t.text).join(''), p.ipa);
  assert.deepEqual(p.displayTokens.filter(t => t.phonemeId).map(t => t.phonemeId), p.phonemes);
  p.phonemes.forEach(id => assert.ok(pids.has(id))); assert.ok(p.sourceReferences.length);
}
for (const sample of samples) {
  assert.ok(wids.has(sample.wordId) && ws.find(w => w.id === sample.wordId).word === sample.word);
  assert.equal(sample.enrichmentStatus, 'pending');
  assert.equal(sample.reviewer, null);
  assert.ok(sample.ipa && sample.sourceIds.length && sample.alignmentSource);
  sample.phonemes.forEach(id => assert.ok(pids.has(id)));
  assert.equal(sample.segments.map(s => s.grapheme).join(''), sample.word);
  assert.deepEqual(sample.segments.flatMap(s => s.phonemeIds), sample.phonemes);
}
for (const candidate of read('audio-candidates.json').candidates) {
  assert.equal(candidate.downloadStatus, 'not-downloaded');
  assert.equal(candidate.listeningReview, 'not-performed');
  assert.ok(candidate.ipaSource.startsWith('https://'));
  if (candidate.status === 'license-and-accent-evidence-confirmed') assert.ok(candidate.author && candidate.licenseUrl && candidate.sourcePage);
}
const registry=read('curriculum/index.json');assert.equal(new Set(registry).size,registry.length);
for(const id of registry) {assert.match(id,/^[a-z0-9_]+$/);const c=read('curriculum/'+id+'.json');assert.equal(c.id,id);unique(c.units);for(const u of c.units) {assert.ok(u.name); for(const e of u.entries) assert.ok(wids.has(e.wordId) && e.meaning);}}
const pep=read('curriculum/pep_2026_g6_s1.json');assert.equal(pep.units.length,6);assert.equal(pep.units.flatMap(u=>u.entries).length,146);assert.equal(new Set(pep.units.flatMap(u=>u.entries.map(e=>e.wordId))).size,145);
for(const a of audio) { assert.ok(['missing','pending','verified'].includes(a.status));if(a.status==='verified') {assert.ok(a.src && a.source && a.license && a.reviewer); if(!a.src.startsWith('https://')) {assert.ok(a.src.startsWith('/assets/audio/') && !a.src.includes('..')); assert.ok(fs.existsSync(path.join(root,'miniprogram',a.src)));} } }
console.log('Data OK: 44 phonemes, 6 PEP units, 146 entries, 145 unique PEP words.');
