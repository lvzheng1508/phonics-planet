"""Build pitch-preserving slow previews from archived originals; never slow twice.
Requires ffmpeg. Run python3 scripts/slow-word-audio.py, then npm run build:data.
"""
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
manifest = root / 'seed-data/audio-manifest.json'
assets = json.loads(manifest.read_text())
version = subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0]
for asset in assets:
    if asset['status'] != 'synthetic-preview':
        continue
    assert asset['kind'] == 'word' and asset['reviewStatus'] == 'pending'
    original = root / 'assets/source-audio/piper-vctk-p225/v1' / (asset['id'] + '.mp3')
    original_hash = hashlib.sha1(original.read_bytes()).hexdigest()
    assert original_hash == asset.get('processing', {}).get('originalSha1', asset['sha1'])
    relative = '/assets/audio/words/en-GB/piper-vctk-p225/v2-slow/' + original.name
    output = root / 'miniprogram' / relative.lstrip('/')
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(original),
                    '-af', 'atempo=0.75', '-ac', '1', '-b:a', '96k', str(output)], check=True)
    data = output.read_bytes()
    asset.update(src=relative, sha1=hashlib.sha1(data).hexdigest(), bytes=len(data),
                 processing={'tool': version, 'filter': 'atempo=0.75', 'tempo': 0.75,
                             'originalSha1': original_hash,
                             'originalPath': str(original.relative_to(root)),
                             'reviewStatus': 'pending'})
manifest.write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n')
print('Prepared slow word previews; source audio and review status preserved.')
