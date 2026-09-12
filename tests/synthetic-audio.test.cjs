const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isPlayableAsset}=require('../miniprogram/services/audio-policy');
const data=require('../miniprogram/data/generated');
const content=require('../miniprogram/services/content-service').createContentService(data);
test('all curriculum word previews use valid remote descriptors and the selected voice',()=>{
  const resources=require('../miniprogram/services/resource-service');
  const assets=data.audio.filter(a=>a.status==='synthetic-preview');
  const standard=require('../seed-data/voice-standard.json');
  const ids=new Set(data.curriculums.flatMap(c=>c.units.flatMap(u=>u.entries.map(e=>e.wordId))));
  assert.equal(assets.length,ids.size);
  for(const asset of assets){
    assert.ok(asset.src.startsWith('resource://'),asset.id);
    assert.ok(resources.isResourceDescriptor(asset));
    assert.ok(resources.createUrlProvider('https://example.com')(asset).startsWith('https://example.com/audio/'));
    assert.equal(asset.generator.voice,standard.voice);
    assert.equal(asset.generator.speed,standard.speed);
    assert.equal(asset.generator.modelSha256,standard.modelSha256);
    assert.equal(asset.distributionAllowed,true);
  }
});
test('every unit has playable AI words without becoming reviewed teaching or phoneme audio',()=>{
 for(const curriculum of data.curriculums) for(const unit of curriculum.units){
  const words=content.unitWords(curriculum.id,unit.id);
  assert.equal(words.length,unit.entries.length);
  for(const word of words){
    const detail=content.detail(word.id,{curriculumId:curriculum.id,unitId:unit.id});
    assert.equal(detail.audioPlayable,true,word.word);
    assert.equal(detail.audioSynthetic,true);
    assert.equal(detail.audioReady,false);
    assert.equal(detail.sequenceReady,false);
    const asset=content.audio(detail.audioId);
    assert.equal(isPlayableAsset(asset),false);
    assert.equal(isPlayableAsset(asset,true),false);
    assert.equal(isPlayableAsset({...asset,kind:'phoneme'},false,true),false);
    assert.equal(isPlayableAsset({...asset,source:null},false,true),false);
  }
 }
 assert.ok(data.audio.filter(a=>a.kind==='phoneme').every(a=>!isPlayableAsset(a,false,true)));
});
