# 可分发整词音色候选

目的：替换不适合项目公开分发的 Apple Flo，保留英式女声、清晰和较慢的听感。用户于 2026-09-12 选定 A · Emma；当前全量标准已记入 seed-data/voice-standard.json。此目录保留选型样本，完整音频按独立 resource 仓库分发。

| 组别 | 音色 | 引擎 speed | 对比文件 |
| --- | --- | --- | --- |
| A | Kokoro bf_emma（英式女声） | 0.8 | style-A.mp3 |
| B | Kokoro bf_isabella（英式女声） | 0.8 | style-B.mp3 |
| C | Kokoro bf_emma（英式女声） | 0.7 | style-C.mp3 |

每组按 was → village → gingerbread house 播放，词间加入 1 秒静音。另保留 short/medium/long 三词各组的单独 WAV 与 MP3。speed 是模型内部参数，不是词/分钟，不能声称等于 Flo 115 词/分钟；没有后期变速。

## 来源与使用条件

- 原始模型：[hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)，v1.0，Apache-2.0。官方模型卡明确支持生产环境和商业 API 部署。模型卡快照与 Apache 许可保存于 licenses/。
- 音色：[官方 VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) 标为 British English female。模型卡也说明极短文本可能较弱，因此这组三个实际教材词仍须听审，不能只凭模型评分采用。
- ONNX 转换及运行库：[thewh1teagle/kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx)，运行库 MIT，模型沿用 Apache-2.0。使用 model-files-v1.1 发布中的 v1.0 float32 权重与 v1.0 音色包。
- 本项目用单词文本自行合成整词；不是下载词典录音，不使用 Apple 系统音色或 Flo 克隆。模型许可单独记录，不将输出标成第三方 CC BY 录音。
- 所有样本为 synthetic-preview、pending。文件解码/摘要校验不能代替发音听审，没有逐音时间标注。

生成：在隔离 Python 3.10 环境安装 `kokoro-onnx==0.6.1 soundfile`，下载 generate.py 中注明的模型/音色文件，运行 `python generate.py MODEL_DIR`。manifest.json 保存实际模型、音色包 SHA-256、声音参数、时长及输出 SHA-1。运行时依赖版本另存 requirements-lock.txt；生成工具不进入小程序运行环境。

选定后，全部 145 个 Word 去重生成，写入 `/Users/lvzheng/Cursor/resource/audio/words/en-GB/<voice>/<version>/`，更新该仓库 manifest/许可记录和应用 seed-data 的 resource:// 清单，再构建及校验。跨单元同词共享，音素音频仍独立处理。

## 文件验证记录

2026-09-12：9 段单词 MP3 的摘要互不相同，另有 3 段对比音轨；12 份 MP3 共 414,972 字节，逐份通过 FFmpeg 解码、字节数及 SHA-1 核对。自动检查不等于听审，当前没有将任何样本标记为 verified。
