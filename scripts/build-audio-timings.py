"""Bind pending IPA timing references to exact audio hashes.
Uses native synthesis durations as a prior and independent CTC phoneme alignment
on the published MP3. Low-confidence boundaries interpolate the native unequal durations between reliable anchors.
Usage: python scripts/build-audio-timings.py PHONEME_MODEL_DIR
Run analyze-word-acoustics.py and recover-emma-timings.py first.
These are machine estimates, not human-reviewed phoneme annotations.
"""
import json
import hashlib
import soundfile as sf
import pathlib
import sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
def read(p): return json.loads(p.read_text())
def write(p, data): p.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
def canonical(s):
    return s.replace('ɹ','r').replace('ɡ','g').replace('ɛ','e').replace('æ','a').replace('ɐ','ə').replace('ɪ','i')

# Recognizer-label alternatives account for its accent/transcription inventory.
# They do not modify the displayed IPA or assert a pronunciation is correct.
ALIASES = {'r':['ɹ','r'], 'e':['ɛ','e'], 'ɡ':['ɡ'], 'æ':['æ','a'],
           'ɒ':['ɒ','ɔ','ʌ'], 'ɑː':['ɑː','ɑ'], 'ɔː':['ɔː','ɔ'],
           'ə':['ə','ɐ','ɚ'], 'ɪ':['ɪ','i','ᵻ'], 'i':['i','ɪ','iː'],
           'ɜː':['ɜː','ɜ','ɚ'], 'əʊ':['əʊ','oʊ'], 'ɪə':['iə','ɪɹ'],
           'ʊə':['ʊə','ʊɹ'], 't':['t','ɾ'], 'l':['l','ɫ']}
MARKS = {'ˈ','ˌ',' '}

def native_tokens(draft, capture):
    phones=[]; stress_start=None
    for t in capture['timings']:
        if t['symbol'] in {'ˈ','ˌ'}:
            stress_start = t['start'] if stress_start is None else stress_start
        elif t['symbol'] not in {' ','.',',','!','?','-'}:
            phones.append(dict(t, start=t['start'] if stress_start is None else stress_start))
            stress_start=None
        else: stress_start=None
    expected=''.join(t['text'] for t in draft['displayTokens'] if t['text'] not in MARKS)
    actual=''.join(t['symbol'] for t in phones)
    assert canonical(expected)==canonical(actual), (draft['wordId'],expected,actual)
    assert len(expected)==len(phones), (draft['wordId'],'unsupported multichar generator symbol')
    spans=[]; cursor=0
    for t in draft['displayTokens']:
        if t['text'] in MARKS: continue
        chunk=phones[cursor:cursor+len(t['text'])];cursor+=len(t['text'])
        spans.append(dict(text=t['text'],start=chunk[0]['start'],end=chunk[-1]['end']))
    return spans,actual

def align(prob, native, vocab):
    frames=len(prob); n=len(native); states=2*n+1
    # CTC emits blank before, between and after the expected phones.
    emissions=np.empty((frames,states)); emissions[:,::2]=np.log(np.maximum(prob[:,0:1],1e-12))
    times=np.arange(frames)*.02+.0125
    values=[]
    for j,t in enumerate(native):
        ids=[vocab[x] for x in ALIASES.get(t['text'],[t['text']]) if x in vocab]
        assert ids, t['text']
        value=prob[:,ids].sum(axis=1); values.append(value)
        center=(t['start']+t['end'])/2
        penalty=.25*((times-center)/(max(.04,(t['end']-t['start'])/2)+.12))**2
        score=np.log(np.maximum(value,1e-12))-penalty
        score[(times<t['start']-.18)|(times>t['end']+.18)]=-1e9
        emissions[:,2*j+1]=score
    score=np.full(states,-1e12);score[0]=0
    paths=np.zeros((frames,states),np.int16)
    for f in range(frames):
        new=np.full(states,-1e12)
        for s in range(states):
            origins=[s]
            if s: origins.append(s-1)
            if s%2 and s>1 and native[s//2]['text']!=native[s//2-1]['text']:origins.append(s-2)
            origin=max(origins,key=lambda k:score[k]); paths[f,s]=origin
            new[s]=score[origin]+emissions[f,s]
        score=new
    state=states-1 if score[-1]>score[-2] else states-2
    path=[]
    for f in range(frames-1,-1,-1):path.append(state);state=int(paths[f,state])
    path=np.array(path[::-1]);spans=[]
    for j,t in enumerate(native):
        indices=np.flatnonzero(path==2*j+1)
        assert len(indices), t
        spans.append(dict(text=t['text'],start=round(indices[0]*.02,4),end=round((indices[-1]+1)*.02,4),confidence=round(float(values[j][indices].max()),4)))
    return spans

vocab=read(pathlib.Path(sys.argv[1])/'vocab.json')
native={r['wordId']:r for r in read(ROOT/'artifacts/audio-sync-audit-2026-09-12/generator-timings.json')}
acoustic={r['wordId']:r for r in read(ROOT/'artifacts/audio-sync-audit-2026-09-12/acoustic-audit.json')}
drafts={r['wordId']:r for r in read(ROOT/'seed-data/word-pronunciations.json')}
rows=[];audit=[]
for asset in read(ROOT/'seed-data/audio-manifest.json'):
    if asset.get('kind')!='word' or asset.get('status')!='synthetic-preview':continue
    wid=asset['wordId'];draft=drafts[wid];capture=native[wid];analysis=acoustic[wid]
    assert capture['replayMatched'] and capture['audioSha1']==analysis['audioSha1']==asset['sha1']
    spans,spoken=native_tokens(draft,capture)
    prob=np.load(ROOT/'assets/generated-audio/acoustic-audit'/(asset['sha1']+'.npz'))['probabilities']
    aligned=align(prob,spans,vocab)
    confidence=min(t['confidence'] for t in aligned)
    # CTC is a sequence of sparse onset anchors, not phone durations. Never
    # finish a vowel at its emission spike: it lasts until the next phone.
    wav=ROOT/read(ROOT/'seed-data/voice-standard.json')['outputDirectory']/'wav'/(wid+'.wav')
    assert hashlib.sha256(wav.read_bytes()).hexdigest()==asset['wavSha256']
    wave,rate=sf.read(wav)
    rms=np.array([np.sqrt(np.mean(wave[i:i+240]**2)) for i in range(0,len(wave),240)])
    active=np.flatnonzero(rms>rms.max()*.01)
    speech_start=max(0,float(active[0])*.01-.01)
    speech_end=min(asset['duration'],float(active[-1]+1)*.01+.01)
    assert speech_end>speech_start
    # The first/last boundaries come from the waveform. Strong internal CTC
    # anchors constrain the model's unequal durations; weak phone predictions
    # are interpolated only between those anchors, never equal-width letters.
    anchors=[(spans[0]['start'],speech_start)]
    fallback_count=0
    for i,t in enumerate(aligned[1:],1):
        if t['confidence']>=.20 and anchors[-1][1]+.02<t['start']<speech_end-.02:
            anchors.append((spans[i]['start'],t['start']))
        else: fallback_count+=1
    anchors.append((spans[-1]['end'],speech_end))
    starts=np.interp([t['start'] for t in spans],[x[0] for x in anchors],[x[1] for x in anchors])
    final=[]
    for i,t in enumerate(spans):
        start=float(starts[i]);end=float(starts[i+1]) if i+1<len(spans) else speech_end
        # Preserve a real quiet interval (>=50ms) before the next phone.
        left=int(np.ceil((start+.02)/.01));right=int(np.floor(end/.01))
        if right>left and spans[i]['end']<spans[min(i+1,len(spans)-1)]['start']:
            quiet=rms[left:right]<rms.max()*.01
            run=0
            for j,q in enumerate(quiet):
                run=run+1 if q else 0
                if run>=5:
                    end=min(end,(left+j-run+1)*.01);break
        final.append(dict(text=t['text'],start=round(start,4),end=round(end,4)))
    tokens=[]; cursor=0
    for t in draft['displayTokens']:
        if t['text'] in MARKS:
            point=final[cursor]['start'] if cursor<len(final) else final[-1]['end']
            tokens.append(dict(text=t['text'],start=point,end=point))
        else:
            span=final[cursor];cursor+=1
            tokens.append(dict(text=t['text'],start=span['start'],end=span['end']))
    assert all(0<=t['start']<=t['end']<=asset['duration']+.001 for t in tokens),wid
    assert all(tokens[i]['start']<=tokens[i+1]['start'] for i in range(len(tokens)-1)),wid
    method='ctc-anchors-with-generator-interpolation' if fallback_count else 'ctc-anchors-with-waveform-boundaries'
    rows.append(dict(wordId=wid,audioId=asset['id'],audioSha1=asset['sha1'],ipa=draft['ipa'],duration=asset['duration'],status='aligned',reviewStatus='pending',reviewer=None,method=method,tokens=tokens))
    audit.append(dict(wordId=wid,text=asset['text'],audioSha1=asset['sha1'],ipa=draft['ipa'],generatorPhones=spoken,method=method,minAcousticConfidence=round(confidence,4),interpolatedBoundaries=fallback_count,speechStart=speech_start,speechEnd=speech_end,nativeSpans=spans,acousticSpans=aligned,pronunciationOverride=bool(asset.get('generator',{}).get('phonemeInput')),reviewStatus='pending',listeningReview='not-performed'))
write(ROOT/'seed-data/audio-timings.json',rows)
write(ROOT/'artifacts/audio-sync-audit-2026-09-12/alignment-audit.json',audit)
print('Aligned',len(rows),'words;',sum(r['interpolatedBoundaries'] for r in audit),'uncertain internal boundaries use model duration interpolation.')
