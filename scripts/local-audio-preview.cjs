function withLocalWordPreviews(data, manifest) {
  const preview = structuredClone(data);
  const assets = new Map((manifest.assets || []).map(a => [a.id, a]));
  const words = new Map(preview.words.map(w => [w.audioId, w]));
  preview.audio = preview.audio.map(original => {
    const word = words.get(original.id), local = assets.get(original.id);
    if (!word || original.kind !== 'word' || original.status === 'verified' || !local
      || local.wordId !== word.id || local.text !== word.word || local.kind !== 'word'
      || local.status !== 'preview' || local.reviewStatus !== 'pending'
      || local.license !== 'local-preview-only' || local.distributionAllowed !== false) return original;
    return {...local, src: '/preview-audio/' + word.id + '.mp3', reviewer: null};
  });
  return preview;
}
module.exports = { withLocalWordPreviews };
