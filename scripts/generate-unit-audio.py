"""Generate authorized AI word previews; requires piper-tts==1.8.0 and ffmpeg.
Usage: python scripts/generate-unit-audio.py MODEL RESOURCE_REPO
Never synthesizes individual IPA symbols. Existing reviewed audio is protected.
"""
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import wave
from piper import PiperVoice, SynthesisConfig

root = pathlib.Path(__file__).resolve().parents[1]
model, resource = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
def read(path):
    return json.loads(path.read_text())
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
words = {w['id']: w for w in read(root / 'seed-data/words.json')}
unit = next(u for u in read(root / 'seed-data/curriculum/pep_2026_g6_s1.json')['units'] if u['id'] == 'unit_1')
assert len(unit['entries']) == 26
manifest = read(root / 'seed-data/audio-manifest.json')
assets = {a['id']: a for a in manifest}
assert all(assets[words[e['wordId']]['audioId']]['status'] != 'verified' for e in unit['entries'])
config = read(pathlib.Path(str(model) + '.json'))
speaker = config['speaker_id_map']['p225']
voice = PiperVoice.load(str(model))
provenance = {
    'engine': 'piper-tts 1.8.0', 'model': 'en_GB-vctk-medium',
    'speaker': 'p225', 'speakerId': speaker, 'lengthScale': 1.1,
    'modelSha256': hashlib.sha256(model.read_bytes()).hexdigest(),
    'configSha256': hashlib.sha256(pathlib.Path(str(model) + '.json').read_bytes()).hexdigest(),
    'modelLicense': 'MIT', 'datasetLicense': 'CC BY 4.0',
    'dataset': 'https://datashare.ed.ac.uk/handle/10283/3443',
    'modelCard': 'https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/vctk/medium/MODEL_CARD',
    'reviewStatus': 'pending', 'listeningReview': 'not-performed'
}
generated = []
with tempfile.TemporaryDirectory() as tmp:
    for entry in unit['entries']:
        word = words[entry['wordId']]
        relative = 'audio/words/en-GB/piper-vctk-p225/v1/' + word['id'] + '.mp3'
        target = resource / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        wav = pathlib.Path(tmp) / 'word.wav'
        with wave.open(str(wav), 'wb') as output:
            voice.synthesize_wav(word['word'] + '.', output, syn_config=SynthesisConfig(speaker_id=speaker, length_scale=1.1))
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(wav), '-ac', '1', '-b:a', '96k', str(target)], check=True)
        data = target.read_bytes()
        asset = assets[word['audioId']]
        asset.update(src='resource://' + relative, status='synthetic-preview',
            source=provenance['modelCard'], license='CC BY 4.0',
            licenseUrl='https://creativecommons.org/licenses/by/4.0/',
            author='Phonics Planet (AI synthesis); Piper / rhasspy; VCTK: Yamagishi, Veaux, MacDonald',
            reviewer=None, reviewStatus='pending', generator=provenance,
            text=word['word'], sha1=hashlib.sha1(data).hexdigest(), bytes=len(data), extension='mp3')
        generated.append(asset.copy())
        print(word['word'], len(data), flush=True)
write(root / 'seed-data/audio-manifest.json', manifest)
existing = read(resource / 'manifest.json')
ids = {a['id'] for a in generated}
write(resource / 'manifest.json', [a for a in existing if a['id'] not in ids] + generated)
write(resource / 'licenses/unit-1-synthesis.json', provenance)
