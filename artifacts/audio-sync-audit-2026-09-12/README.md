# 整词音标渐变检查 · 2026-09-12

覆盖全部 145 个 Word、6 单元的 146 条关联。对每份 MP3 校验 SHA-1、字节数及解码，使用独立音素识别器分析实际文件，并将合成时间与原始 WAV 对照。结果用于开发版跟读参考，**不是逐词人工听审或教学审核通过**。原生微信开发者工具/真机仍需复测。

## 修正内容

- 首批 Emma 资源已推送：`6392fd6`；9 词读法修正版已推送：`669f159`。
- 保持 A Emma / bf_emma / speed 0.8；was、village、gingerbread house 的 A 组 MP3 字节不变。
- 9 个默认音素化结果与草稿 IPA 不同的词，以模型原生整词音素输入重生成，记录于 `seed-data/pronunciation-overrides.json`。这是控制整词合成读法，不是把 IPA 当作文字朗读，也不用于单音录音。旧 v1 文件保留，新文件位于 resource 的 `v2-aligned/`。
- `glass`、`into`、`taikonaut` 等读法对照公开词典文字；专名与其他草稿继续 pending。来源：[Cambridge glass](https://dictionary.cambridge.org/pronunciation/english/glass)、[Oxford into](https://www.oxfordlearnersdictionaries.com/us/definition/english/into)、[Collins taikonaut](https://www.collinsdictionary.com/dictionary/english/taikonaut)、[Cambridge difference](https://dictionary.cambridge.org/us/dictionary/english/difference)。没有复制词典音频。
- 145 份时间表绑定确切 `audioSha1 + ipa`。播放时按 currentTime 推进；不再把 IPA 字符平均分摊到整段 MP3。
- 重音符、空格无发音时长；开头和尾部安静区不参与渐变。缺失、过期或非法时间表降级到整词进度，不能套用旧音频的时间表。

## 方法和限制

Kokoro duration 作为相对时长参考；再次合成的波形与原稿相关系数须 >=0.98、匹配能量比例 >=0.999，或直接捕获生成当次的 duration。允许可验证的整体裁切偏移，不因文件尾部安静区长短变化误判。结果见 `generator-timings.json`。

独立识别器为 [facebook/wav2vec2-lv-60-espeak-cv-ft](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft)，固定 revision `ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4`，Apache-2.0，仅作离线分析。20ms CTC 帧与合成时间先验共同定位音素出现位置。CTC 尖峰不是发音结束点，音的填充持续到下一个边界；波形 10ms RMS（峰值的 1%，两端 10ms 余量）约束实际起止。清晰的词间安静区保留。

总计 731 个显示发音段；其中 77 个内部边界的声学置信度不足，使用相邻可信位置之间的模型相对时长插值，逐词数量列于下表。识别器有口音/转写差异，不能用预测标签自动修改草稿 IPA 或宣称发音正确。所有 timing 与 pronunciation 继续 `pending`，页面标为“音标跟读参考”。

复现顺序（工具在隔离 Python 环境，不添加小程序运行时依赖）：

```sh
python scripts/generate-emma-audio.py --models /path/to/kokoro-models
python scripts/generate-emma-audio.py --publish /path/to/resource
python scripts/recover-emma-timings.py /path/to/kokoro-models
python scripts/analyze-word-acoustics.py /path/to/phoneme-model /path/to/resource
python scripts/build-audio-timings.py /path/to/phoneme-model
npm run check
npm run resources:verify -- --local /path/to/resource
# resource 推送后，再执行 npm run resources:verify
```

识别环境：Python 3.10、torch 2.2.2、transformers 4.40.2、numpy 1.26.4、soundfile、ffmpeg。合成环境沿用试听目录的 requirements-lock。模型文件留在本地，不进入资源仓库。生成的 acoustic cache 以音频 SHA-1 为键，仅存于忽略目录；改音频必须重新分析并构建时间表。

## 验证结果

- 145 份生成文件的摘要、字节数及解码通过；147 项本地资源和匿名 HTTPS 均通过（145 整词 + 2 技术样本）。
- `npm run check`：62 项测试通过、13 页 WCC/WCSC 编译通过。测试覆盖所有词起止、停止复位、长词 house 起点、失效时间表降级、详情/复习按本词媒体时钟更新。
- 浏览器本地 resource 模式抽查 electricity 与 gingerbread house：播放中部分音标填充、后续音保持未填充，播放结束按钮恢复、全部渐变归零。该结果不代表远程浏览器或微信真机播放验收。

## 逐词记录

以下为机器逐项检查记录。时间单位秒；“插值”表示需优先人工复核的内部边界数量。人工听审全部待完成。

| 单词 | 发声起点 | 发声终点 | 内部插值 | 读法修正版 |
| --- | ---: | ---: | ---: | --- |
| was | 0.04 | 0.68 | 0 | 保留 v1 |
| climb | 0.03 | 0.89 | 0 | 保留 v1 |
| kilometre | 0.03 | 1.23 | 2 | 保留 v1 |
| gingerbread house | 0.01 | 1.71 | 0 | 保留 v1 |
| go | 0.05 | 0.68 | 1 | 保留 v1 |
| send | 0.05 | 0.76 | 0 | 保留 v1 |
| thousand | 0.05 | 1.13 | 0 | 保留 v1 |
| clay | 0.03 | 0.78 | 0 | 保留 v1 |
| see | 0.04 | 0.62 | 1 | 保留 v1 |
| village | 0.05 | 0.80 | 0 | 保留 v1 |
| eat | 0.03 | 0.66 | 0 | 保留 v1 |
| dry | 0.03 | 0.82 | 0 | 保留 v1 |
| take | 0.03 | 0.71 | 0 | 保留 v1 |
| view | 0.03 | 0.77 | 0 | 保留 v1 |
| inspiring | 0.03 | 1.36 | 1 | 保留 v1 |
| bamboo | 0.03 | 0.98 | 1 | 保留 v1 |
| pumpkin | 0.03 | 0.98 | 2 | 保留 v1 |
| restaurant | 0.03 | 1.14 | 0 | 保留 v1 |
| airport | 0.05 | 0.91 | 1 | 保留 v1 |
| New Zealand | 0.03 | 1.33 | 1 | 保留 v1 |
| Hong Kong-Zhuhai-Macao Bridge | 0.03 | 2.39 | 0 | v2 |
| Paris | 0.04 | 1.23 | 0 | 保留 v1 |
| Eiffel Tower | 0.04 | 1.51 | 0 | 保留 v1 |
| Terracotta Warriors | 0.03 | 1.84 | 0 | 保留 v1 |
| Jinggangshan Revolution Museum | 0.01 | 2.54 | 1 | v2 |
| the Red Army | 0.03 | 1.39 | 1 | 保留 v1 |
| dress | 0.05 | 0.79 | 0 | 保留 v1 |
| paste | 0.04 | 0.82 | 0 | 保留 v1 |
| gala | 0.05 | 0.83 | 0 | 保留 v1 |
| count down | 0.03 | 1.31 | 0 | 保留 v1 |
| marathon | 0.04 | 1.05 | 0 | 保留 v1 |
| as | 0.03 | 0.68 | 0 | 保留 v1 |
| race | 0.03 | 1.31 | 0 | 保留 v1 |
| run | 0.05 | 0.75 | 0 | 保留 v1 |
| cheer | 0.04 | 0.74 | 1 | 保留 v1 |
| book fair | 0.03 | 0.96 | 2 | 保留 v1 |
| read | 0.05 | 1.20 | 0 | 保留 v1 |
| writer | 0.03 | 0.87 | 0 | 保留 v1 |
| make | 0.03 | 0.79 | 0 | 保留 v1 |
| sing | 0.04 | 0.66 | 0 | 保留 v1 |
| wear | 0.05 | 0.73 | 1 | 保留 v1 |
| yesterday | 0.03 | 1.17 | 0 | 保留 v1 |
| notice | 0.03 | 1.03 | 2 | 保留 v1 |
| wake | 0.02 | 0.68 | 1 | 保留 v1 |
| later | 0.05 | 0.90 | 0 | 保留 v1 |
| judge | 0.05 | 0.81 | 1 | 保留 v1 |
| win | 0.05 | 0.70 | 0 | 保留 v1 |
| begin | 0.05 | 0.85 | 2 | 保留 v1 |
| winner | 0.05 | 0.72 | 1 | 保留 v1 |
| ever | 0.05 | 0.67 | 0 | 保留 v1 |
| exciting | 0.02 | 1.21 | 0 | v2 |
| cold | 0.05 | 0.85 | 1 | 保留 v1 |
| ill | 0.03 | 0.61 | 0 | 保留 v1 |
| head | 0.03 | 0.64 | 0 | 保留 v1 |
| runny nose | 0.03 | 1.37 | 3 | 保留 v1 |
| soon | 0.05 | 0.74 | 1 | 保留 v1 |
| fever | 0.05 | 0.78 | 0 | 保留 v1 |
| cough | 0.05 | 0.68 | 1 | 保留 v1 |
| discuss | 0.03 | 0.94 | 0 | 保留 v1 |
| diet | 0.03 | 0.85 | 0 | 保留 v1 |
| stay up | 0.04 | 0.93 | 1 | 保留 v1 |
| cry | 0.05 | 0.82 | 0 | 保留 v1 |
| another | 0.05 | 0.83 | 2 | 保留 v1 |
| call | 0.04 | 0.74 | 0 | 保留 v1 |
| email | 0.04 | 0.93 | 0 | 保留 v1 |
| unhappy | 0.03 | 1.00 | 1 | 保留 v1 |
| glass | 0.05 | 0.77 | 1 | v2 |
| may | 0.05 | 0.75 | 1 | 保留 v1 |
| add | 0.04 | 0.66 | 0 | 保留 v1 |
| video | 0.05 | 0.83 | 1 | 保留 v1 |
| better | 0.04 | 0.78 | 0 | 保留 v1 |
| money | 0.05 | 1.18 | 2 | 保留 v1 |
| pocket money | 0.03 | 1.35 | 0 | 保留 v1 |
| schoolbag | 0.03 | 0.99 | 0 | 保留 v1 |
| goods | 0.05 | 0.81 | 1 | 保留 v1 |
| drink | 0.04 | 0.85 | 0 | 保留 v1 |
| service | 0.05 | 0.95 | 0 | 保留 v1 |
| haircut | 0.03 | 0.89 | 2 | 保留 v1 |
| microscope | 0.02 | 1.29 | 0 | 保留 v1 |
| lucky | 0.05 | 0.82 | 1 | 保留 v1 |
| save up | 0.03 | 0.97 | 0 | 保留 v1 |
| sale | 0.05 | 0.76 | 0 | 保留 v1 |
| ticket | 0.05 | 0.84 | 0 | 保留 v1 |
| manage | 0.05 | 0.90 | 0 | 保留 v1 |
| difficult | 0.04 | 1.07 | 1 | 保留 v1 |
| sell | 0.04 | 0.64 | 0 | 保留 v1 |
| half | 0.04 | 1.00 | 1 | 保留 v1 |
| for example | 0.03 | 1.36 | 2 | v2 |
| planet | 0.05 | 0.90 | 0 | 保留 v1 |
| earth | 0.03 | 0.70 | 1 | 保留 v1 |
| sky | 0.04 | 0.75 | 1 | 保留 v1 |
| daytime | 0.03 | 1.14 | 0 | 保留 v1 |
| cloud | 0.05 | 0.90 | 0 | 保留 v1 |
| moon | 0.05 | 1.28 | 1 | 保留 v1 |
| star | 0.04 | 0.66 | 0 | 保留 v1 |
| space | 0.05 | 0.85 | 0 | 保留 v1 |
| outer space | 0.03 | 1.52 | 0 | 保留 v1 |
| space station | 0.03 | 1.56 | 0 | 保留 v1 |
| ocean | 0.03 | 0.89 | 1 | 保留 v1 |
| marble | 0.05 | 0.89 | 0 | 保留 v1 |
| satellite | 0.05 | 1.17 | 0 | 保留 v1 |
| soil | 0.05 | 0.76 | 1 | 保留 v1 |
| alien | 0.03 | 1.01 | 0 | 保留 v1 |
| sunrise | 0.03 | 1.14 | 0 | 保留 v1 |
| rover | 0.03 | 0.85 | 1 | 保留 v1 |
| into | 0.05 | 0.81 | 1 | v2 |
| telescope | 0.04 | 1.13 | 0 | 保留 v1 |
| astronaut | 0.04 | 1.20 | 3 | 保留 v1 |
| month | 0.04 | 1.10 | 2 | 保留 v1 |
| spaceship | 0.03 | 1.01 | 0 | 保留 v1 |
| cloth | 0.03 | 0.77 | 0 | 保留 v1 |
| toothpaste | 0.04 | 1.11 | 0 | 保留 v1 |
| taikonaut | 0.03 | 1.32 | 2 | v2 |
| question | 0.04 | 1.04 | 0 | 保留 v1 |
| time | 0.03 | 0.81 | 0 | 保留 v1 |
| sunset | 0.03 | 0.95 | 0 | 保留 v1 |
| Mars | 0.03 | 0.82 | 0 | 保留 v1 |
| power | 0.04 | 0.78 | 1 | 保留 v1 |
| electricity | 0.03 | 1.40 | 1 | v2 |
| solar | 0.03 | 0.81 | 2 | 保留 v1 |
| type | 0.03 | 0.68 | 0 | 保留 v1 |
| energy | 0.05 | 0.87 | 0 | 保留 v1 |
| light | 0.03 | 0.78 | 0 | 保留 v1 |
| source | 0.05 | 0.78 | 1 | 保留 v1 |
| heat | 0.03 | 0.68 | 0 | 保留 v1 |
| cool | 0.04 | 1.10 | 1 | 保留 v1 |
| resource | 0.03 | 0.95 | 1 | 保留 v1 |
| run out | 0.02 | 1.03 | 0 | 保留 v1 |
| few | 0.04 | 0.66 | 2 | 保留 v1 |
| change | 0.03 | 0.91 | 0 | 保留 v1 |
| quick | 0.03 | 0.64 | 0 | 保留 v1 |
| shower | 0.05 | 0.77 | 2 | 保留 v1 |
| unplug | 0.05 | 1.12 | 1 | 保留 v1 |
| difference | 0.03 | 0.96 | 1 | v2 |
| reduce | 0.05 | 1.06 | 2 | 保留 v1 |
| air conditioner | 0.03 | 1.59 | 0 | 保留 v1 |
| drive | 0.03 | 0.85 | 0 | 保留 v1 |
| reuse | 0.03 | 1.64 | 0 | 保留 v1 |
| own | 0.05 | 0.75 | 0 | 保留 v1 |
| market | 0.03 | 0.92 | 0 | 保留 v1 |
| top | 0.03 | 0.85 | 0 | 保留 v1 |
| bottle | 0.05 | 0.82 | 1 | 保留 v1 |
| dirty | 0.03 | 0.88 | 0 | 保留 v1 |
| side | 0.05 | 0.75 | 0 | 保留 v1 |
| useful | 0.03 | 0.91 | 1 | 保留 v1 |
