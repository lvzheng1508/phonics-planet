function isPlayableAsset(asset, allowPreview = false, allowSyntheticWords = false) {
  if (!asset || !asset.src || !asset.source || !asset.license) return false;
  if (asset.status === 'verified') return !!asset.reviewer;
  if (asset.status === 'synthetic-preview') return allowSyntheticWords && asset.kind === 'word'
    && asset.reviewStatus === 'pending' && !!asset.generator && !!asset.licenseUrl;
  return allowPreview && asset.status === 'preview' && asset.kind === 'word' && asset.license === 'local-preview-only';
}
module.exports = { isPlayableAsset };
