function isPlayableAsset(asset, allowPreview = false) {
  if (!asset || !asset.src || !asset.source || !asset.license) return false;
  if (asset.status === 'verified') return !!asset.reviewer;
  return allowPreview && asset.status === 'preview' && asset.kind === 'word' && asset.license === 'local-preview-only';
}
module.exports = { isPlayableAsset };
