# 单词 IPA 候选与来源

本轮给全部 145 个教材 Word 实体补充了独立的英式 IPA 候选，保存于 `seed-data/word-pronunciations.json`。全部 `status: pending`，没有人工审核者，也不代表已有相匹配的音频。可在明确标识待审核的开发预览中查看；不得据此宣称已经完成教学内容审核。

## 数据约定

- `ipa` 不含外层斜线，保留主重音、次重音和短语空格。
- `displayTokens` 拼接结果必须与 IPA 完全相同。双元音、长元音、塞擦音分别作为一个 token；重音与空格仅用于排版。
- `phonemes` 按顺序保存能映射到现有 44 音素表的 ID；`phonemeIndex` 是这个数组的索引。它不是音频时间戳，也不是字母索引。
- 12 个词含现代词典使用的弱元音 /i/。这些 token 的 `phonemeId` 和 `phonemeIndex` 为 null，并有说明。不把它们改写成长元音 /iː/ 或短元音 /ɪ/，也不能把过滤后的 `phonemes` 当作完整的逐音播放序列。
- 强读与弱读不能由拼写自动推定。was、as、into 先使用独立词形；for example 使用短语弱读与 linking r；对应选择仍须核对最终录音。
- `sourceReferences.checked` 仅表示本次 AI 读取到网页检索结果中的具体文字证据，**不等于**内容、人声或教材语境已经审核。`checked:false` 的通用词典入口只是待查来源，不是该条内容的证据。
- 本文件为 AI 逐项编写的候选，不导入 eSpeak/GPL 发音数据库，不批量复制词典释义或音频。

## 本次有直接文字证据的 6 个词

核查日期：2026-09-08。仅据下列词典发布方页面的文字结果复核 IPA；音节分隔点不进入本项目显示串。网页有时返回 403，本轮未下载词典音频。

| 词 | 核对内容 | 原始页面 |
| --- | --- | --- |
| gingerbread house | UK /ˈdʒɪndʒəbred ˌhaʊs/，house 是名词，末尾 /s/ | [Cambridge](https://dictionary.cambridge.org/us/dictionary/english/gingerbread-house?topic=sweets) |
| read | 原形 /riːd/；过去式与过去分词 /red/ | [Cambridge](https://dictionary.cambridge.org/us/dictionary/english/read) |
| gala | UK /ˈɡɑːlə/ | [Cambridge](https://dictionary.cambridge.org/pronunciation/english/gala) |
| taikonaut | British English /ˈtaɪkəʊˌnɔːt/ | [Collins](https://www.collinsdictionary.com/dictionary/english/taikonaut) |
| resource | UK 第一候选 /rɪˈzɔːs/；另有 /ˈriːsɔːs/ | [Cambridge](https://dictionary.cambridge.org/us/pronunciation/english/resource) |
| Eiffel Tower | British 栏 /ˌaɪfəl ˈtaʊə/，孤立读音不显示词尾 linking r | [Collins](https://www.collinsdictionary.com/dictionary/english-spanish/eiffel-tower) |

其余 139 条是 AI 独立整理的候选，未做逐词来源核验。引用词典不代表获得其音频复制许可；没有把词典录音加入项目。

## 容易误教的条目

1. **read 的教材语境未确认。** 当前 Unit 2 的 entry 仅写“阅读”，没有时态或 `pronunciationId`。数据保留 `read_base` 与 `read_past` 两种候选，默认词典原形不能冒充已确定的教材读法。若教材句子是过去时，应选择 /red/ 并使用匹配录音。
2. **Jinggangshan 与 Zhuhai 缺少权威英语发音依据。** 本轮只留下显式警示的英语化近似候选，重音与元音尤其待核对。它们不是汉语拼音的 IPA 转写，也不能宣称是标准英语唯一读法。完整专名还要核对整句录音。
3. **kilometre、restaurant、resource 存在常见变体。** 当前选择一种候选，不应把其他合理变体判错；后续音频必须与所选 IPA 一致。
4. **复合词与短语的重音依赖语境。** 英语化地名、复合专名及词组需要整条复核，不能只按组成单词通过审核。
5. **音素串不等于拼读对齐。** `climb` 的静音、`gingerbread` 的字母组合等，需要单独审核 grapheme 数据。已有 6 条 `learning-samples.json` 继续保持待审核，本文件不覆盖它们。
6. **播放进度不等于逐音时间。** 整词播放进度可驱动渐变，但缺少人工或可靠工具校验的分音时间戳时，不能声称高亮严格对齐到每一个音素。系统合成语音也不自动证明 IPA 正确。

## 进入教学发布前

逐条复核英式转写与教材语境，记录审核者和日期；确认音频许可、内容及口音；核对弱元音与变体。只有完整映射且确有逐音录音的条目才能启用逐音播放；若需要整词中精确逐音高亮，应另存真实录音对应的时间边界。不要为了通过覆盖率检查自动改成 verified。
