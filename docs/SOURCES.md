# 来源与重建记录

访问日期：2026-09-08。

- 用户提供的 ChatGPT 对话「音标学习建议」：conversationId 6a9d60d9-7ff8-83e8-ac27-badae156abde。产品方案可读，附件接口返回空数组；未声称恢复原 zip。正文参考见 reference/original-product-discussion.md。
- pep-official：https://www.pep.com.cn/zslth/yyptzy/xypep/6s/ 。搜索索引显示新版六上目录，直接访问返回 403；不是已核验整本教材的证据。
- pep-vocabulary-public：https://zy.21cnjy.com/26146921 。公开预览中 Unit 1–6 的词项和组织事实用于建立索引，释义简化整理；不复制其音标转码、排版、练习或图像。作为二手资料，教材内容保持 pending。
- phoneme-reference：https://www.cambridgeenglish.org/images/168875-tkt-module-1-describing-language-phonology.pdf 。参考传统英式音素分类，未复制图表版式与音频；常见拼写和示例自行整理待审核。

这些链接是核验来源，不等于素材再分发许可。应用没有抓取或热链词典/教材音频。

## 首批发音候选

6 个隔离的拼读候选见 `seed-data/learning-samples.json`。IPA 参考 Cambridge 对应词条，链接逐项保存在 sourceIds；字母与音素对齐由 AI 起草，仍 pending。该文件不进入运行时，不能据此标记 Word 为 verified。

公开录音调查见 `seed-data/audio-candidates.json`。例如 [moon 文件页](https://commons.wikimedia.org/wiki/File:En-uk-moon.ogg)、[sky 文件页](https://commons.wikimedia.org/wiki/File:En-uk-sky.ogg) 与 [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/)。调查已区分许可证据、候选下载 URL、下载状态和试听状态。由于文件下载失败，当前没有引入第三方媒体文件。
