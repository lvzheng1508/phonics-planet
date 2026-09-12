"""Analyze each exact MP3 with an independent phoneme recognizer (local tooling).
Usage: python scripts/analyze-word-acoustics.py MODEL_DIR RESOURCE_DIR
Requires torch 2.2.2, transformers 4.40.2, numpy 1.26.4 and ffmpeg.
Acoustic labels are diagnostic predictions, never teaching verification.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

import numpy as np
import torch
from transformers import Wav2Vec2Config, Wav2Vec2ForCTC

ROOT = pathlib.Path(__file__).resolve().parents[1]
model_dir, resource = map(pathlib.Path, sys.argv[1:3])
torch.set_num_threads(2)
torch.set_num_interop_threads(1)
state = torch.load(model_dir / 'pytorch_model.bin', map_location='cpu', weights_only=True)
# Preserve all legacy weight-normalization parameters with modern PyTorch names.
state = {k.replace('pos_conv_embed.conv.weight_g', 'pos_conv_embed.conv.parametrizations.weight.original0').replace('pos_conv_embed.conv.weight_v', 'pos_conv_embed.conv.parametrizations.weight.original1'): v for k, v in state.items()}
model = Wav2Vec2ForCTC(Wav2Vec2Config.from_json_file(str(model_dir / 'config.json')))
model.load_state_dict(state, strict=True)
del state
model.eval()
vocab = json.loads((model_dir / 'vocab.json').read_text())
labels = {v: k for k, v in vocab.items()}
cache = ROOT / 'assets/generated-audio/acoustic-audit'
cache.mkdir(parents=True, exist_ok=True)
out = ROOT / 'artifacts/audio-sync-audit-2026-09-12/acoustic-audit.json'
out.parent.mkdir(parents=True, exist_ok=True)
records = []
for asset in json.loads((ROOT / 'seed-data/audio-manifest.json').read_text()):
    if asset.get('kind') != 'word' or asset.get('status') != 'synthetic-preview':
        continue
    mp3 = resource / asset['src'].removeprefix('resource://')
    assert hashlib.sha1(mp3.read_bytes()).hexdigest() == asset['sha1']
    cached = cache / (asset['sha1'] + '.npz')
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 'f32le', '-ar', '16000', '-ac', '1', '-'])
    waveform = np.frombuffer(raw, dtype=np.float32).copy()
    if cached.exists():
        probabilities = np.load(cached)['probabilities']
    else:
        normalized = (waveform - waveform.mean()) / np.sqrt(waveform.var() + 1e-7)
        with torch.no_grad():
            probabilities = model(torch.from_numpy(normalized).unsqueeze(0)).logits.softmax(-1)[0].numpy()
        np.savez_compressed(cached, probabilities=probabilities)
    ids = probabilities.argmax(-1)
    runs = []
    for i, index in enumerate(ids):
        if index and (i == 0 or ids[i-1] != index):
            runs.append(dict(symbol=labels[int(index)], start=round(i*.02, 4), confidence=round(float(probabilities[i, index]), 4)))
    record = dict(wordId=asset['wordId'], text=asset['text'], audioSha1=asset['sha1'], duration=len(waveform)/16000,
                  recognizer='facebook/wav2vec2-lv-60-espeak-cv-ft', revision='ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4',
                  reviewStatus='pending', greedyRuns=runs)
    records.append(record)
    temp = out.with_suffix('.tmp')
    temp.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    temp.replace(out)
    print(len(records), asset['text'], ' '.join(x['symbol'] for x in runs), flush=True)
print('Analyzed', len(records), 'exact MP3 files.', flush=True)
