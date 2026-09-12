"""Recover synthesis frame timings only after matching the versioned source waveform.
Analysis tool: no manifest mutation and no speech publication.
Usage: python scripts/recover-emma-timings.py MODEL_DIR
"""
import hashlib
import json
import pathlib
import sys

import numpy as np
import onnxruntime as rt
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parents[1]
def read(path):
    return json.loads(path.read_text())
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

standard = read(ROOT / 'seed-data/voice-standard.json')
models = pathlib.Path(sys.argv[1])
assert sha(models / 'kokoro-v1.0.onnx') == standard['modelSha256']
assert sha(models / 'voices-v1.0.bin') == standard['voicePackSha256']
options = rt.SessionOptions()
options.intra_op_num_threads = 2
options.inter_op_num_threads = 1
engine = Kokoro.from_session(rt.InferenceSession(str(models / 'kokoro-v1.0.onnx'), sess_options=options, providers=['CPUExecutionProvider']), str(models / 'voices-v1.0.bin'))
assert engine.has_timings
out = ROOT / 'artifacts/audio-sync-audit-2026-09-12/generator-timings.json'
out.parent.mkdir(parents=True, exist_ok=True)
records = read(out) if out.exists() else []
cached = {r['wordId']: r for r in records}
records = []
for asset in read(ROOT / 'seed-data/audio-manifest.json'):
    if asset.get('generator', {}).get('voice') != standard['voice']:
        continue
    old = cached.get(asset['wordId'])
    if old and old['audioSha1'] == asset['sha1'] and old['replayMatched']:
        records.append(old)
        continue
    original = ROOT / standard['outputDirectory'] / 'wav' / (asset['wordId'] + '.wav')
    assert sha(original) == asset['wavSha256']
    reference, sr = sf.read(original)
    direct = ROOT / standard['outputDirectory'] / 'timings' / (asset['wordId'] + '.json')
    if direct.exists():
        capture = read(direct)
        if capture['audioSha1'] == asset['sha1'] and capture['sourceWavSha256'] == asset['wavSha256']:
            record = dict(capture, text=asset['text'], sourceDuration=len(reference)/sr, replayMatched=True, timingSource='direct-synthesis', modelSha256=standard['modelSha256'], reviewStatus='pending')
            records.append(record)
            out.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
            print(len(records), asset['text'], 'direct capture', flush=True)
            continue
    phoneme_input = asset.get('generator', {}).get('phonemeInput')
    waveform, rate, timing = engine.create_timed(phoneme_input or asset['text'] + '.', voice=standard['voice'], speed=standard['speed'], lang='en-gb', is_phonemes=bool(phoneme_input))
    assert sr == rate == 24000
    n = min(len(reference), len(waveform))
    lag = 0
    correlation = float(np.corrcoef(reference[:n], waveform[:n])[0, 1])
    if correlation < .98:
        size = 1 << (len(reference) + len(waveform) - 1).bit_length()
        cross = np.fft.irfft(np.fft.rfft(reference, size) * np.fft.rfft(waveform[::-1], size), size)
        center = len(waveform) - 1
        radius = 2400
        lag = int(np.argmax(cross[center-radius:center+radius+1])) - radius
        a, b = max(0,lag), max(0,-lag)
        n = min(len(reference)-a, len(waveform)-b)
        correlation = float(np.corrcoef(reference[a:a+n], waveform[b:b+n])[0,1])
    # High correlation validates the shared speech; length changes may only alter the quiet tail.
    a, b = max(0,lag), max(0,-lag)
    coverage = min(float(np.sum(reference[a:a+n]**2)/np.sum(reference**2)), float(np.sum(waveform[b:b+n]**2)/np.sum(waveform**2)))
    matched = correlation >= .98 and coverage >= .999
    record = dict(wordId=asset['wordId'], text=asset['text'], audioSha1=asset['sha1'], sourceWavSha256=asset['wavSha256'],
                  sourceDuration=len(reference)/sr, replayDuration=len(waveform)/sr, waveformCorrelation=correlation,
                  replayMatched=matched, alignmentOffset=lag/sr, matchedEnergyFraction=coverage, modelSha256=standard['modelSha256'], reviewStatus='pending',
                  timings=[dict(symbol=t.phoneme, start=round(min(len(reference)/sr,max(0,t.start+lag/sr)),6), end=round(min(len(reference)/sr,max(0,t.end+lag/sr)),6)) for t in timing])
    records.append(record)
    temp = out.with_suffix('.tmp')
    temp.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    temp.replace(out)
    print(len(records), asset['text'], 'matched' if matched else 'UNMATCHED', round(correlation,6), flush=True)
out.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print('Checked', len(records), 'waveforms;', sum(r['replayMatched'] for r in records), 'matched.', flush=True)
