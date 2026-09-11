const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isPlayableAsset}=require('../miniprogram/services/audio-policy');
const data=require('../miniprogram/data/generated');
const content=require('../miniprogram/services/content-service').createContentService(data);
test('Unit 1 has 26 playable AI previews without becoming reviewed teaching audio',()=>{
  const words=content.unitWords('pep_2026_g6_s1','unit_1');
  assert.equal(words.length,26);
  for(const word of words){
    const detail=content.detail(word.id,{curriculumId:'pep_2026_g6_s1',unitId:'unit_1'});
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
  assert.equal(content.detail('word_moon').audioPlayable,false);
});
