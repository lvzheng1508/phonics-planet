"""Generate/resume selected whole words, verify, then publish to local resource repo.

python generate-emma-audio.py --models MODEL_DIR
python generate-emma-audio.py --verify
python generate-emma-audio.py --publish /path/to/resource
Never pushes, synthesizes phoneme assets, or promotes review status.
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]

def read(path):
    return json.loads(path.read_text())

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)

def digest(path, algorithm='sha256'):
    return hashlib.new(algorithm, path.read_bytes()).hexdigest()

def check_audio(output, asset):
    wav = output / 'wav' / (asset['wordId'] + '.wav')
    mp3 = output / 'mp3' / (asset['wordId'] + '.mp3')
    assert digest(wav) == asset['wavSha256'], str(wav)
    assert digest(mp3, 'sha1') == asset['sha1'] and mp3.stat().st_size == asset['bytes'], str(mp3)
    with wave.open(str(wav)) as audio:
        assert audio.getnchannels() == 1 and audio.getframerate() == 24000 and audio.getsampwidth() == 2
        assert audio.getnframes() > 1000 and any(audio.readframes(audio.getnframes()))
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp3), '-f', 'null', '-'], check=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--models', type=pathlib.Path)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--verify', action='store_true')
    modes.add_argument('--publish', type=pathlib.Path)
    args = parser.parse_args()
    standard = read(ROOT / 'seed-data/voice-standard.json')
    assert standard['voice'] == 'bf_emma' and standard['speed'] == 0.8 and standard['distributionAllowed']
    output = ROOT / standard['outputDirectory']
    words = {w['id']: w for w in read(ROOT / 'seed-data/words.json')}
    usages = {}
    for cid in read(ROOT / 'seed-data/curriculum/index.json'):
        for unit in read(ROOT / ('seed-data/curriculum/' + cid + '.json'))['units']:
            for entry in unit['entries']:
                usages.setdefault(entry['wordId'], []).append({'curriculumId': cid, 'unitId': unit['id']})
    overrides = {r['wordId']: r for r in read(ROOT / 'seed-data/pronunciation-overrides.json')}
    app = read(ROOT / 'seed-data/audio-manifest.json')
    app_assets = {a['id']: a for a in app}
    selected = [words[wid] for wid in usages if app_assets[words[wid]['audioId']]['status'] != 'verified']
    manifest_path = output / 'manifest.json'
    previous = read(manifest_path) if manifest_path.exists() else {}
    cached = {a['wordId']: a for a in previous.get('assets', [])} if previous.get('standard') == standard else {}
    reference = ROOT / standard['referenceDirectory']
    audition = read(reference / 'manifest.json')
    assert audition['modelSha256'] == standard['modelSha256']
    assert audition['voicePackSha256'] == standard['voicePackSha256']
    references = {s['word']: s for s in audition['samples'] if s['label'] == standard['referenceLabel']}
    generator = {k: standard[k] for k in ('engine', 'model', 'modelSha256', 'voicePackSha256', 'voice', 'speed', 'phonemizerLanguage', 'textSuffix', 'modelLicense', 'runtimeLicense')}
    generator.update(modelCard=audition['modelCard'], modelDownload=audition['modelDownload'], voiceDownload=audition['voiceDownload'], reviewStatus='pending', listeningReview='not-performed', cpuThreads=2)
    assets = []
    engine = None
    for word in selected:
        override = overrides.get(word['id'], {})
        phoneme_input = override.get('phonemeInput')
        resource_dir = override.get('resourceDirectory', standard['resourceDirectory'])
        existing = cached.get(word['id'])
        if existing and existing['text'] == word['word'] and existing['generator'].get('phonemeInput') == phoneme_input:
            assert existing['kind'] == 'word' and existing['status'] == 'synthetic-preview' and existing['reviewStatus'] == 'pending'
            assert existing['src'] == 'resource://' + resource_dir + '/' + word['id'] + '.mp3'
            assert all(existing['generator'][k] == standard[k] for k in ('voice', 'speed', 'modelSha256', 'voicePackSha256'))
            check_audio(output, existing)
            existing['usages'] = usages[word['id']]
            assets.append(existing)
            continue
        assert not (args.verify or args.publish), 'Missing/stale generated audio: ' + word['id']
        for directory in ('wav', 'mp3'):
            (output / directory).mkdir(parents=True, exist_ok=True)
        wav = output / 'wav' / (word['id'] + '.wav')
        mp3 = output / 'mp3' / (word['id'] + '.mp3')
        ref = None if phoneme_input else references.get(word['word'])
        timing = None
        if ref:
            assert ref['voice'] == standard['voice'] and ref['speed'] == standard['speed']
            assert digest(reference / ref['wav']) == ref['wavSha256']
            assert digest(reference / ref['file'], 'sha1') == ref['sha1']
            shutil.copyfile(reference / ref['wav'], wav)
            shutil.copyfile(reference / ref['file'], mp3)
        else:
            if engine is None:
                assert args.models, '--models is required to synthesize missing audio'
                import importlib.metadata
                import numpy as np
                import onnxruntime as rt
                import soundfile as sf
                from kokoro_onnx import Kokoro
                assert 'kokoro-onnx ' + importlib.metadata.version('kokoro-onnx') == standard['engine']
                model, voices = args.models / 'kokoro-v1.0.onnx', args.models / 'voices-v1.0.bin'
                assert digest(model) == standard['modelSha256'] and digest(voices) == standard['voicePackSha256']
                options = rt.SessionOptions()
                options.intra_op_num_threads = 2
                options.inter_op_num_threads = 1
                engine = Kokoro.from_session(rt.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider']), str(voices))
            audio, rate, timing = engine.create_timed(phoneme_input or word['word'] + standard['textSuffix'], voice=standard['voice'], speed=standard['speed'], lang=standard['phonemizerLanguage'], is_phonemes=bool(phoneme_input))
            assert rate == standard['sampleRate'] and len(audio) > 1000 and np.isfinite(audio).all()
            assert 0.01 < np.max(np.abs(audio)) <= 1.0, 'Silent or clipped output: ' + word['word']
            sf.write(str(wav), audio, rate, subtype='PCM_16')
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(wav), '-ac', '1', '-b:a', standard['mp3Bitrate'], str(mp3)], check=True)
        with wave.open(str(wav)) as audio:
            duration = audio.getnframes() / audio.getframerate()
        asset = dict(id=word['audioId'], wordId=word['id'], kind='word', accent='en-GB', text=word['word'],
                     src='resource://' + resource_dir + '/' + mp3.name,
                     status='synthetic-preview', reviewStatus='pending', reviewer=None,
                     source=audition['modelCard'], author='Phonics Planet (AI synthesis); hexgrad/Kokoro-82M',
                     license=standard['license'], licenseUrl=standard['licenseUrl'], distributionAllowed=True,
                     generator=generator, sha1=digest(mp3, 'sha1'), bytes=mp3.stat().st_size, extension='mp3',
                     duration=duration, wavSha256=digest(wav), usages=usages[word['id']])
        if ref:
            asset['auditionReference'] = standard['referenceDirectory'] + '/' + ref['file']
            asset['generator'] = dict(generator, cpuThreads='audition default')
        if phoneme_input:
            asset['generator'] = dict(generator, phonemeInput=phoneme_input, inputIpa=override['ipa'])
        if timing is not None:
            write(output / 'timings' / (word['id'] + '.json'), dict(wordId=word['id'], audioSha1=asset['sha1'], sourceWavSha256=asset['wavSha256'], timings=[dict(symbol=t.phoneme, start=round(t.start,6), end=round(t.end,6)) for t in timing]))
        check_audio(output, asset)
        assets.append(asset)
        checkpoint = dict(cached)
        checkpoint.update({a['wordId']: a for a in assets})
        write(manifest_path, dict(standard=standard, assets=list(checkpoint.values())))
        print(f"{len(assets)}/{len(selected)} {word['word']}: {duration:.3f}s", flush=True)
    assert len(assets) == len(selected)
    print(f"Verified {len(assets)} words, {sum(len(a['usages']) for a in assets)} unit entries, {sum(a['bytes'] for a in assets)} MP3 bytes", flush=True)
    if not args.publish:
        if not args.verify:
            write(manifest_path, dict(standard=standard, assets=assets))
        return
    resource = args.publish.resolve()
    assert (resource / '.git').exists() and (resource / 'manifest.json').is_file(), 'Expected existing resource repository'
    # Preflight every collision before writing. Published version files are immutable.
    for asset in assets:
        target = resource / asset['src'].removeprefix('resource://')
        assert target.resolve().is_relative_to(resource)
        if target.exists():
            assert digest(target, 'sha1') == asset['sha1'], 'Version collision; choose a new version: ' + str(target)
    for asset in assets:
        target = resource / asset['src'].removeprefix('resource://')
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copyfile(output / 'mp3' / target.name, target)
        assert digest(target, 'sha1') == asset['sha1'] and target.stat().st_size == asset['bytes']
    license_dir = resource / 'licenses' / standard['id']
    license_dir.mkdir(parents=True, exist_ok=True)
    for file in (reference / 'licenses').iterdir():
        if file.is_file():
            shutil.copyfile(file, license_dir / file.name)
    shutil.copyfile(reference / 'requirements-lock.txt', license_dir / 'requirements-lock.txt')
    write(license_dir / 'generation.json', dict(standard=standard, generator=generator, words=len(assets), usages=sum(len(a['usages']) for a in assets), note=audition['licenseNote']))
    replacement = {a['id']: a for a in assets}
    remote = read(resource / 'manifest.json')
    write(resource / 'manifest.json', [a for a in remote if a['id'] not in replacement] + assets)
    write(ROOT / 'seed-data/audio-manifest.json', [replacement.get(a['id'], a) for a in app])
    print('Published files and manifests to local resource repository; not pushed.', flush=True)

if __name__ == '__main__':
    main()
