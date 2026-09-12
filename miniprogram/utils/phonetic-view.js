// Timed tokens use the media clock. Untimed content retains a whole-recording sweep.
function progressTokens(tokens, progress = 0, currentTime = 0) {
  const timed = tokens.length && tokens.every(t => t.timing && Number.isFinite(t.timing.start) && Number.isFinite(t.timing.end) && t.timing.end >= t.timing.start);
  const total = tokens.reduce((n, t) => n + t.text.length, 0) || 1;
  let offset = 0;
  return tokens.map((t, index) => {
    const span = timed && t.timing;
    const amount = span ? (currentTime <= 0 || currentTime < span.start ? 0 : span.end === span.start ? 1 : (currentTime - span.start) / (span.end - span.start)) : (progress * total - offset) / t.text.length;
    const fill = Math.max(0, Math.min(1, amount));
    offset += t.text.length;
    return { ...t, key: String(index), fill: Math.round(fill * 100), style: 'width:' + Math.round(fill * 100) + '%' };
  });
}
function tokenizeIpa(ipa, phonemes) {
  const symbols = phonemes.slice().sort((a, b) => b.symbol.length - a.symbol.length);
  const tokens = []; let offset = 0;
  while (offset < ipa.length) {
    const phoneme = symbols.find(p => ipa.startsWith(p.symbol, offset));
    const text = phoneme ? phoneme.symbol : Array.from(ipa.slice(offset))[0];
    tokens.push({ text, phonemeId: phoneme ? phoneme.id : null }); offset += text.length;
  }
  return tokens;
}
module.exports = { progressTokens, tokenizeIpa };
