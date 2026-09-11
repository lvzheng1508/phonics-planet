# 音频制作与接入

2026-09-11：已实现资源供应商隔离、本地 FIFO 缓存及独立微信验证页。当前实际下载阻塞与接入步骤见 [RESOURCE-CACHE.md](RESOURCE-CACHE.md)。正式音频支持 `resource://` 地址并要求 SHA-1/bytes/extension；参考测试录音没有升级为正式教学内容。

音素与单词分别录制，统一英式口音。不要把辅音补成带 schwa 的字母读音；不要让 TTS 念 IPA 字符充当音素。
录音保留原始无损文件，发布导出单声道 MP3，峰值不削波，响度与首尾静音一致。由具备英语发音能力的审核者听辨单音、整词、易混对及口音一致性。
资源位在 seed-data/audio-manifest.json。每个条目填 src/source/license/reviewer，经核验后 status=verified。本地 src 以 /assets/audio/ 开头；仅 manifest 完整且音频实际存在可通过数据构建。当前目录只有说明文件，没有伪造 MP3。
依次播放只是教学拆音，不等同于自然整词连读。整词需独立音频。页面退出立即取消。

## 2026-09-08 公开录音接入调查

用户确认先接入许可清楚的公开音频，缺少的再补录。逐项证据保存在 `seed-data/audio-candidates.json`，候选清单不属于可播放的 `audio-manifest.json`。

- moon、sky、book、green、tree 的 Commons 文件说明页标注 Association Shtooka / Judith Franck、London 与 CC BY 3.0 US。其中 moon、sky 属于当前独立教材词，其余仅保留调查记录。
- read、see 的候选文件标签是 “to read / to see”，不能直接当成单独单词录音；试听后如需剪裁，必须记录修改。
- cloud、dry、village 找到 UK 录音条目，但逐文件许可尚未完成核验。climb、clay 在本轮有界调查中未找到 UK 录音。
- 尝试下载 moon/sky 的公开 MP3 时，连接返回 `curl: (35) Recv failure: Connection reset by peer`。未取得媒体、未试听、未产生文件校验值；没有改动资源位的 missing 状态。

后续从候选的 sourcePage 打开原始文件。URL 名为 DerivedNotFetchVerified 的字段只是按源文件名推导的候选下载地址，必须验证真实内容。下载后确认媒体确实是目标整词、口音与音质合适，保存 SHA-256、作者、许可链接、修改记录与审核人，再在 manifest 中登记。不要以词典 IPA 参考页作为复制其录音的许可。

当前仍没有 44 音素的可用录音；整词和单音应分别验收。微信开发者工具与真机还需验证格式支持、首音/尾音、后台取消、快速切换、加载失败和序列高亮。

## 用户授权的系统试听

用户指出缺音标的单词卡不符合项目目标，并明确允许系统英式语音用于开发预览。浏览器服务使用本机 `/usr/bin/say -v Daniel`，按词ID从已登记教材词生成真实WAV文件；参数通过execFile传入，不执行用户拼接的shell。音频只缓存到系统临时目录。该权限不代表正式分发系统声音文件的许可，因此没有将它们加入仓库或正式manifest。

预览虚拟资产status=preview、kind=word、license=local-preview-only；只有浏览器内存配置允许播放，生产配置拒绝该状态，单音类型即使在预览中也不允许合成替代。音标渐变随真实播放时间变化，而非固定倒计时；没有时间标注时不宣称精确对应每个音素。慢速语音和汉语专名仍可能读错，试听不等于教学审核。
