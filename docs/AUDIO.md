# 音频制作与接入

音素与单词分别录制，统一英式口音。不要把辅音补成带 schwa 的字母读音；不要让 TTS 念 IPA 字符充当音素。
录音保留原始无损文件，发布导出单声道 MP3，峰值不削波，响度与首尾静音一致。由具备英语发音能力的审核者听辨单音、整词、易混对及口音一致性。
资源位在 seed-data/audio-manifest.json。每个条目填 src/source/license/reviewer，经核验后 status=verified。本地 src 以 /assets/audio/ 开头；仅 manifest 完整且音频实际存在可通过数据构建。当前目录只有说明文件，没有伪造 MP3。
依次播放只是教学拆音，不等同于自然整词连读。整词需独立音频。页面退出立即取消。
