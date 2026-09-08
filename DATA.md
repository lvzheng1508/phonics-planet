# 数据契约 v1

数据采用 UTF-8 JSON，seed-data 为单一来源。npm run build:data 生成小程序可 require 的 CommonJS 数据模块。

## Phoneme
id 稳定 ASCII 标识；symbol 不含外层斜杠；category 为 vowel/consonant；subCategory 为 short/long/diphthong/plosive/fricative/affricate/nasal/approximant。accent=en-GB。commonSpellings 是候选拼写，contrast 引用其他 Phoneme ID。exampleWord 是展示词字符串，不承诺一定存在于教材 Word。
传统 44 音素模型不表示所有英语口音都恰好 44 音素。/r/ 是教学转写，常见实际音值为 [ɹ]；/ʊə/ 等须按口音与具体词核对。

## Grapheme
id、spellings[]、phonemeIds[]、reviewStatus。表示候选多对多关系；不能据此自动推断任意词发音。单词级对齐保存在 Word.segments。

## Word
id、word、meanings[]、accent、ipa（字符串或 null）、syllables[]、phonemes[]、segments[]、audioId、reviewStatus、enrichmentStatus、sourceIds[]。
segments 元素含 grapheme、phonemeIds[]、可选 note。拼写连缀必须还原单词；phonemeIds 串联等于 phonemes。允许静音 []，允许一个 segment 对多个音素。climb 示例单独放 examples，不冒充正式教材发音。
同形多义词共享实体，meanings 汇集义项；Curriculum.entries.meaning 保存语境。未来同形异音需要 pronunciation variants，不能覆盖 read 的不同读音。

## Curriculum
id、name、publisher、edition、grade、semester、accent、reviewStatus、sourceIds、units[]。
unit 含 id/name/entries[]；entry 含 wordId/meaning。注册到 curriculum/index.json 即可自动出现。不能靠词序推断教材关系。

## UserCollection
id、name、type、wordIds[]、schemaVersion。收藏使用 phonics-planet:collections:v1；所有访问经 StorageService。未来新增自定义词复用 Word 模型，单独本地存储后由 ContentService 合并。

## AudioAsset
id、kind、accent、src（null 或路径/HTTPS URL）、status=missing/pending/verified、source、license、reviewer。仅 verified 且元数据齐全可播放。音频审核与语言 enrichment 审核独立。

## 审核
pending 表示待核对，verified 需要来源及审核记录。不能因为结构校验通过就改成已审核。开发版由 config.showDraftPronunciations 控制显示 word-pronunciations.json 的待核对 IPA，并在详情/复习中标注；正式发布需关闭该开关且完成审核。音标显示、拼读对齐、录音审核分别管理，不能因缺录音隐藏已有音标。

word-pronunciations.json 保存145条候选，wordId关联Word，displayTokens完整还原IPA。现代弱元音 /i/ 不属于传统44独立条目，其token保留原符号，phonemeId为空，不强行映射到 /ɪ/ 或 /iː/。read保留多读法候选，教材语境仍待核实。

播放状态新增 currentTime/duration/progress，来自真实媒体时钟。现阶段渐变仅表示整词播放进度；精确音素同步必须使用单独审核的时间边界。系统试听资产只在浏览器预览内存中注入，status=preview、license=local-preview-only，正式数据与小程序禁止播放该状态。
