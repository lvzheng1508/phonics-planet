const {test}=require('node:test');
const assert=require('node:assert/strict');
const {withLocalWordPreviews}=require('../scripts/local-audio-preview.cjs');
const {isPlayableAsset}=require('../miniprogram/services/audio-policy');
test('Flo previews replace matching whole words in browser memory only, without inheriting old provenance',()=>{
 const data={words:[{id:'word_moon',word:'moon',audioId:'word_moon'}],audio:[
  {id:'word_moon',kind:'word',status:'synthetic-preview',src:'/old.mp3',generator:{model:'Piper'},sha1:'old',license:'CC BY 4.0'},
  {id:'phoneme_u',kind:'phoneme',status:'missing',src:null}]};
 const asset={id:'word_moon',wordId:'word_moon',text:'moon',kind:'word',accent:'en-GB',status:'preview',
  reviewStatus:'pending',source:'macOS Flo',license:'local-preview-only',distributionAllowed:false,
  generator:{voice:'Flo',rateWpm:115},mp3:'mp3/word_moon.mp3',sha1:'new'};
 const manifest={assets:[asset]};
 const preview=withLocalWordPreviews(data,manifest);
 assert.equal(preview.audio[0].src,'/preview-audio/word_moon.mp3');
 assert.equal(preview.audio[0].generator.voice,'Flo');
 assert.equal(preview.audio[0].sha1,'new');
 assert.equal(isPlayableAsset(preview.audio[0]),false);
 assert.equal(isPlayableAsset(preview.audio[0],true),true);
 assert.equal(data.audio[0].license,'CC BY 4.0');
 assert.equal(data.audio[0].src,'/old.mp3');
 assert.deepEqual(preview.audio[1],data.audio[1]);
 // Changing a word without regenerating its speech must not play the old spoken text.
 assert.deepEqual(withLocalWordPreviews(data,{assets:[{...asset,text:'sun'}]}),data);
 const reviewed=structuredClone(data);reviewed.audio[0].status='verified';
 assert.deepEqual(withLocalWordPreviews(reviewed,manifest),reviewed);
 assert.deepEqual(withLocalWordPreviews(data,{assets:[{...asset,license:'CC BY 4.0'}]}),data);
});
