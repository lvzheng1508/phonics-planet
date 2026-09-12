# 整词音频标准

2026-09-12 用户选定 **A · Emma**。本文件及 `seed-data/voice-standard.json` 是后续整词合成标准；旧 Flo 仅保留为历史试听资料。

| 项目 | 已确认标准 |
| --- | --- |
| 模型 | Kokoro-82M v1.0，float32 ONNX |
| 运行库 | kokoro-onnx 0.6.1 |
| 音色 | bf_emma，英式女声 |
| 语言 | en-gb |
| 语速 | 模型 speed=0.8；不是每分钟词数 |
| 输入 | 默认 Word.word 原文加句号；特殊读法使用已记录的模型原生整词 phonemeInput |
| 节奏 | 整词/词组自然朗读，无后期变速、无拆音拼接 |
| 原始音频 | WAV / PCM16 / 24 kHz / 单声道 |
| 分发音频 | MP3 / 单声道 / 96 kbps |
| 状态 | synthetic-preview、pending、reviewer=null |
| 页面标记 | AI 合成试听 · 待发音核对 |
| 进度 | 真实媒体时钟 + 与 SHA-1/IPA 绑定的机器时间表，待人工核对 |

was、village、gingerbread house 直接复用 `artifacts/voice-audition-kokoro-2026-09-12/` 的 A 组 WAV/MP3，保证选型基准不变。其余词使用相同模型、音色和 speed。神经网络再次生成可能存在细微差异，发布版本不得原地覆盖。

## 分发目录与应用链路

- **实际分发仓库**：`/Users/lvzheng/Cursor/resource/`。
- **当前 MP3**：136 条 `audio/words/en-GB/kokoro-emma/v1/word_*.mp3`，9 条 `v2-aligned/word_*.mp3`。
- **资源清单**：resource 仓库 `manifest.json`；保留已有音素技术样本和其他无关条目。
- **许可记录**：resource 仓库 `licenses/kokoro-emma-080-v1/`。
- **应用清单**：本项目 `seed-data/audio-manifest.json`，使用 `resource://audio/words/en-GB/kokoro-emma/<version>/...`，附每文件 SHA-1、字节数和来源。
- **合成原稿与断点记录**：本项目 `assets/generated-audio/kokoro-emma-080-v1/`，只用于生成和复验，不能替代 resource 交付。

页面 → AudioService → ResourceService → 配置的 HTTPS 地址 → 下载校验与本地缓存。保持微信原生运行方式，不把模型、Python 或音频原稿打进小程序。缓存仍是 100 文件 / 8 MiB，因此不承诺全部 145 个词同时离线常驻。

写入本地 resource 仓库与推送到远端必须分别报告。资源未发布前新 URL 不可用；仅本地目录校验或浏览器能播放不代表远程下载成功。正常工作不擅自 push。

## 来源与许可依据

[官方模型卡](https://huggingface.co/hexgrad/Kokoro-82M) 标注 Apache-2.0，并明确支持生产环境及商业 API 部署。[官方音色表](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) 将 bf_emma 列为 British English female。[ONNX 运行库](https://github.com/thewh1teagle/kokoro-onnx) 采用 MIT，转换模型沿用 Apache-2.0。

模型许可、运行库许可、生成音频来源分别记录。本项目用单词文本自行合成，不是复制词典音频，也不冒充第三方 CC BY 录音。模型、音色包 SHA-256 和下载来源固定于标准/逐文件 generator 中，许可文本与模型卡快照随资源保留。已确认音色不代表逐词发音已审核。

## 复现与新增单元

使用 Python 3.10 或兼容环境，根据试听目录 `requirements-lock.txt` 安装隔离工具。下载同目录 manifest.json 所列的 v1.0 ONNX 与 voice pack，生成时核对摘要。`ffmpeg` 需在 PATH。

```sh
python scripts/generate-emma-audio.py --models /path/to/model-directory
python scripts/generate-emma-audio.py --verify
python scripts/generate-emma-audio.py --publish /Users/lvzheng/Cursor/resource
npm run check
npm run resources:verify -- --local /Users/lvzheng/Cursor/resource
```

`--publish` 是写入本地资源仓库并同步应用种子清单，不执行 git push。生成按 curriculum/index.json 读取所有教材，按 Word.id 去重；同词跨单元共享一个文件，已 verified 音频受保护。已生成文件须匹配当前标准、词文、摘要和解码校验才能复用。目标版本发生不同内容的同名文件时拒绝覆盖，应新增版本。

资源推送后再执行 `npm run resources:verify` 验证匿名 HTTPS，随后在微信开发者工具/真机核对下载、播放、切词、切后台、缓存复用。专名、read 等多读词及短词强弱读仍须逐项听审。

浏览器预览默认使用相同远端音频；推送前可以显式执行 `RESOURCE_PREVIEW_ROOT=/Users/lvzheng/Cursor/resource npm run preview` 读取本地 resource 仓库并校验摘要。浏览器不再注入 Flo；本地资源预览不替代原生缓存验收。

## 历史资料

Flo 的参数归档于 `artifacts/voice-audition-2026-09-12/flo-reference-standard.json`，原 145 个本地文件保留在 `assets/local-audio/flo-en-gb-115-v1/`。受 Apple 系统语音使用条款限制，它们不进入 resource 或小程序包；新标准不再使用该音色。旧 Piper 试听也只保留为来源归档。不能把任何一批本地试听数量当作远程交付完成数。

## 本次交付与验证记录

2026-09-12：145 个词、146 条单元关联，共 2,356,317 字节当前 MP3，已写入 resource 的 kokoro-emma/v1 与 v2-aligned 目录。资源仓库和应用清单同步；3 个 A 组基准词文件保持逐字节一致。旧 26 个 Piper 包内 MP3 已移至项目包外的 `assets/source-audio/piper-vctk-p225/v2-slow/`，清单随归档保存。

所有生成 MP3 通过解码和摘要校验；`npm run resources:verify -- --local /Users/lvzheng/Cursor/resource` 通过 147 项（含 2 个技术样本）。`npm run check` 通过 62 项测试，13 页 WCC/WCSC 编译成功。浏览器抽查 gingerbread house 与第六单元 electricity 可进入播放状态，前者播放结束后按钮正常恢复。

resource 已提交推送：`6392fd6`（145 词）、`669f159`（9 词读法修正版）。当前清单全部 147 项匿名 HTTPS 校验通过，包含 9 词修正版。原生微信真机播放未验证。145 词机器对齐已完成，但 77 个内部边界仍需模型时长插值，不能宣称人工逐词听审完成。

特殊读法记录在 `seed-data/pronunciation-overrides.json`，不把整词音素输入充当音素录音。后续新增或更换音频，须同步重建 `seed-data/audio-timings.json`，再运行 `npm run check`。完整方法和逐词结果见 `../artifacts/audio-sync-audit-2026-09-12/README.md`。
