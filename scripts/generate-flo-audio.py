"""Generate all registered curriculum words for personal, local Flo audition.
Run on macOS with system voice access and FFmpeg; no network or runtime deps.
Outputs stay outside miniprogram and the distribution resource repository.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile
import wave

ROOT = pathlib.Path(__file__).resolve().parents[1]

def read(path):
    return json.loads(path.read_text())

def sha1(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()

def inspect_wav(path):
    with wave.open(str(path)) as audio:
        assert audio.getnchannels() == 1 and audio.getframerate() == 22050
        assert audio.getsampwidth() == 2 and audio.getnframes() > 4000
        assert any(audio.readframes(audio.getnframes())), 'Silent output: ' + str(path)
        return audio.getnframes() / audio.getframerate()

def synthesize(standard, voice, text, output):
    subprocess.run(['/usr/bin/say', '-v', voice, '-r', str(standard['rateWpm']),
                    '--file-format=WAVE', '--data-format=LEI16@22050',
                    '-o', str(output), text + standard['textSuffix']], check=True, timeout=30)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true', help='Validate existing files without synthesis')
    args = parser.parse_args()
    standard = read(ROOT / 'artifacts/voice-audition-2026-09-12/flo-reference-standard.json')
    output = ROOT / standard['outputDirectory']
    words = {w['id']: w for w in read(ROOT / 'seed-data/words.json')}
    usages = {}
    for cid in read(ROOT / 'seed-data/curriculum/index.json'):
        for unit in read(ROOT / ('seed-data/curriculum/' + cid + '.json'))['units']:
            for entry in unit['entries']:
                usages.setdefault(entry['wordId'], []).append({'curriculumId': cid, 'unitId': unit['id']})
    manifest_path = output / 'manifest.json'
    previous = read(manifest_path) if manifest_path.exists() else {}
    existing = {a['wordId']: a for a in previous.get('assets', [])} if previous.get('standard') == standard else {}
    if not args.verify:
        output.mkdir(parents=True, exist_ok=True)
        # macOS can silently fall back to Daniel when sandboxed: detect that before batch generation.
        with tempfile.TemporaryDirectory() as temp:
            flo, daniel = pathlib.Path(temp) / 'flo.wav', pathlib.Path(temp) / 'daniel.wav'
            synthesize(standard, standard['voice'], 'was', flo)
            synthesize(standard, 'Daniel', 'was', daniel)
            inspect_wav(flo)
            assert sha1(flo) != sha1(daniel), 'Flo fell back to Daniel; run with normal macOS voice service access.'
    records = []
    system_version = subprocess.check_output(['/usr/bin/sw_vers', '-productVersion'], text=True).strip()
    for index, (word_id, contexts) in enumerate(usages.items(), 1):
        word = words[word_id]
        assert word_id.startswith('word_') and all(c.isalnum() or c == '_' for c in word_id)
        wav, mp3 = output / 'wav' / (word_id + '.wav'), output / 'mp3' / (word_id + '.mp3')
        old = existing.get(word_id, {})
        reusable = old.get('text') == word['word'] and wav.exists() and mp3.exists() and (
            sha1(wav) == old.get('wavSha1') and sha1(mp3) == old.get('sha1'))
        if not reusable:
            assert not args.verify, 'Missing or changed audio: ' + word_id
            wav.parent.mkdir(parents=True, exist_ok=True)
            mp3.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=output) as temp:
                generated = pathlib.Path(temp) / 'word.wav'
                synthesize(standard, standard['voice'], word['word'], generated)
                inspect_wav(generated)
                encoded = pathlib.Path(temp) / 'word.mp3'
                subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(generated),
                                '-ac', '1', '-b:a', standard['mp3Bitrate'], str(encoded)], check=True)
                generated.replace(wav)
                encoded.replace(mp3)
        duration = inspect_wav(wav)
        if args.verify:
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(mp3), '-f', 'null', '-'], check=True)
        record = {'id': word['audioId'], 'wordId': word_id, 'text': word['word'], 'contexts': contexts,
                  'kind': 'word', 'accent': 'en-GB', 'status': 'preview', 'reviewStatus': 'pending',
                  'source': 'macOS Flo British English system synthesis', 'license': standard['license'],
                  'licenseUrl': standard['licenseUrl'], 'distributionAllowed': False,
                  'generator': {'engine': standard['engine'], 'voice': standard['voice'],
                                'rateWpm': standard['rateWpm'], 'macOS': system_version},
                  'wav': str(wav.relative_to(output)), 'mp3': str(mp3.relative_to(output)),
                  'duration': duration, 'bytes': mp3.stat().st_size, 'sha1': sha1(mp3), 'wavSha1': sha1(wav)}
        records.append(record)
        if not args.verify:
            # Checkpoint completed files so interrupted batches can resume.
            checkpoint = {**existing, **{a['wordId']: a for a in records}}
            temporary = manifest_path.with_suffix('.tmp')
            temporary.write_text(json.dumps({'standard': standard, 'assets': list(checkpoint.values())}, ensure_ascii=False, indent=2) + '\n')
            temporary.replace(manifest_path)
        if index % 10 == 0 or index == len(usages):
            print(('Verified' if args.verify else 'Prepared'), index, '/', len(usages), flush=True)
    if not args.verify:
        manifest_path.write_text(json.dumps({'standard': standard, 'assets': records}, ensure_ascii=False, indent=2) + '\n')
    print('All', len(records), 'words;', sum(a['bytes'] for a in records), 'MP3 bytes;', output)

if __name__ == '__main__':
    main()
