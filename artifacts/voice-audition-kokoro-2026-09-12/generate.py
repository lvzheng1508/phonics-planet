"""Generate isolated whole-word audition clips; does not modify app manifests.

Usage: python generate.py MODEL_DIR
Requires kokoro-onnx==0.6.1, soundfile and ffmpeg. Model release:
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1
"""
import hashlib
import importlib.metadata
import json
import pathlib
import subprocess
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

root = pathlib.Path(__file__).resolve().parent
models = pathlib.Path(sys.argv[1])
model = models / 'kokoro-v1.0.onnx'
voices = models / 'voices-v1.0.bin'
engine = Kokoro(str(model), str(voices))
styles = [('A', 'bf_emma', 0.8), ('B', 'bf_isabella', 0.8), ('C', 'bf_emma', 0.7)]
words = [('short', 'was'), ('medium', 'village'), ('long', 'gingerbread house')]

def digest(path, algorithm='sha256'):
    return hashlib.new(algorithm, path.read_bytes()).hexdigest()

def encode(path):
    mp3 = path.with_suffix('.mp3')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(path), '-ac', '1', '-b:a', '96k', str(mp3)], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 'null', '-'], check=True)
    return {'file': mp3.name, 'bytes': mp3.stat().st_size, 'sha1': digest(mp3, 'sha1')}

manifest = {
    'purpose': 'whole-word voice selection; not yet selected for bulk generation',
    'status': 'synthetic-preview', 'reviewStatus': 'pending', 'listeningReview': 'not-performed',
    'engine': 'kokoro-onnx ' + importlib.metadata.version('kokoro-onnx'),
    'model': 'Kokoro-82M v1.0, float32 ONNX', 'modelSha256': digest(model),
    'voicePackSha256': digest(voices), 'modelLicense': 'Apache-2.0',
    'runtimeLicense': 'MIT',
    'modelCard': 'https://huggingface.co/hexgrad/Kokoro-82M',
    'voiceSource': 'https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md',
    'modelDownload': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx',
    'voiceDownload': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin',
    'licenseNote': 'Model/runtime licenses are recorded separately from the generated audio; not Apple system speech. Upstream explicitly supports production/commercial deployments. No claim that these audio outputs were independently licensed by a third party.',
    'accent': 'en-GB', 'phonemizerLanguage': 'en-gb', 'input': 'Word text plus a period; never IPA as text',
    'speedNote': 'Engine speed ratios are not words per minute and do not equal Flo 115 WPM.',
    'processing': 'PCM16 WAV and 96kbps mono MP3; no post-generation time stretching',
    'samples': [], 'comparisons': []
}
for label, voice, speed in styles:
    clips = []
    for length, word in words:
        audio, rate = engine.create(word + '.', voice=voice, speed=speed, lang='en-gb')
        assert rate == 24000 and len(audio) > 1000 and np.isfinite(audio).all()
        assert np.max(np.abs(audio)) > 0.01, 'Reject silent output'
        path = root / f'{length}-{label}.wav'
        sf.write(str(path), audio, rate, subtype='PCM_16')
        clips.append(audio)
        manifest['samples'].append({
            'label': label, 'word': word, 'voice': voice, 'speed': speed,
            'duration': len(audio) / rate, 'wav': path.name, 'wavSha256': digest(path),
            **encode(path)
        })
        print(label, voice, speed, word, round(len(audio) / rate, 3), flush=True)
    combined = np.concatenate([part for clip in clips for part in (clip, np.zeros(24000))][:-1])
    path = root / f'style-{label}.wav'
    sf.write(str(path), combined, 24000, subtype='PCM_16')
    manifest['comparisons'].append({'label': label, 'voice': voice, 'speed': speed, **encode(path)})
(root / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('Generated 9 individual samples and 3 comparison tracks.', flush=True)
