const data = require('../data/generated');
const storage = require('./storage-service');
const config = require('../config');
const { isPlayableAsset } = require('./audio-policy');
const { tokenizeIpa } = require('../utils/phonetic-view');
function createContentService(source, user) {
  const find = (items, id) => items.find(x => x.id === id);
  const api = {
    phonemes: () => source.phonemes, phoneme: id => find(source.phonemes, id),
    words(query = '') {
      const custom = user ? user.snapshot().customWords : []; const all = source.words.concat(custom);
      const q = String(query).trim().toLowerCase();
      return q ? all.filter(w => (w.word + ' ' + w.meanings.join(' ')).toLowerCase().includes(q)) : all;
    },
    word: id => find(api.words(), id), curriculums: () => source.curriculums, curriculum: id => find(source.curriculums, id),
    unit(curriculumId, unitId) { const c = api.curriculum(curriculumId); return c && find(c.units, unitId); },
    unitWords(curriculumId, unitId, query = '') {
      const unit = api.unit(curriculumId, unitId); if (!unit) return [];
      const q = String(query).trim().toLowerCase();
      return unit.entries.map(entry => ({ ...api.word(entry.wordId), contextMeaning: entry.meaning, pronunciationId: entry.pronunciationId || '' }))
        .filter(w => w.id && (!q || (w.word + ' ' + w.contextMeaning).toLowerCase().includes(q)));
    },
    audio: id => find(source.audio, id),
    audioReady(id) { const a = api.audio(id); return !!(a && a.status === 'verified' && a.src && a.source && a.license && a.reviewer); },
    audioPlayable(id) { return isPlayableAsset(api.audio(id), config.allowPreviewAudio, config.allowSyntheticWordAudio); },
    transcription(id) { return find(source.pronunciations || [], id) || (source.pronunciations || []).find(x => x.wordId === id); },
    detail(id, context = {}) {
      const word = api.word(id); if (!word) return null;
      const unit = api.unit(context.curriculumId, context.unitId); const entry = unit && unit.entries.find(x => x.wordId === id);
      const pronunciationId = entry && entry.pronunciationId;
      const variant = pronunciationId && (word.pronunciations || []).find(x => x.id === pronunciationId);
      const pronunciation = pronunciationId ? variant : word;
      const ready = !!(pronunciation && pronunciation.enrichmentStatus === 'verified');
      const draft = !ready && !pronunciationId && config.showDraftPronunciations ? api.transcription(id) : null;
      const displayIpa = ready ? pronunciation.ipa : draft ? draft.ipa : '';
      const phonemes = (ready ? pronunciation.phonemes : draft ? draft.phonemes : []).map(api.phoneme).filter(Boolean);
      const segments = ready ? pronunciation.segments.map((s, i) => ({ ...s, key: String(i), symbols: s.phonemeIds.map(api.phoneme).filter(Boolean).map(p => '/' + p.symbol + '/').join(' '), start: pronunciation.segments.slice(0, i).reduce((n, part) => n + part.phonemeIds.length, 0) })) : [];
      const audioId = pronunciation ? pronunciation.audioId : null;
      return { ...word, contextMeaning: entry ? entry.meaning : '', pronunciationReady: ready,
        ipa: displayIpa, hasIpa: !!displayIpa, pronunciationPending: !!draft && !ready,
        ipaTokens: (draft && draft.displayTokens || tokenizeIpa(displayIpa, source.phonemes)).map((t, i) => ({ ...t, key: String(i) })),
        pronunciationVariants: draft && draft.variants || [],
        phonemes, segments, syllables: ready ? pronunciation.syllables : [], audioId,
        audioPreview: !!(api.audio(audioId) && api.audio(audioId).status === 'preview'),
        audioSynthetic: !!(api.audio(audioId) && api.audio(audioId).status === 'synthetic-preview'),
        audioPlayable: api.audioPlayable(audioId),
        audioReady: api.audioReady(audioId), sequenceReady: ready && phonemes.length > 0 && phonemes.every(p => api.audioReady(p.audioId)),
        sequence: phonemes.map(p => p.audioId), sounds: phonemes.map((p, i) => ({ ...p, key: String(i), index: i, audioIds: [p.audioId], playable: api.audioReady(p.audioId) })) };
    }
  }; return api;
}
module.exports = { ...createContentService(data, storage), createContentService };
