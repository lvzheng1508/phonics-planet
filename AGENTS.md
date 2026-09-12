# AI 开发约束

## 工作入口
先读 README.md、PRODUCT.md、DESIGN.md、DATA.md、IMPLEMENTATION.md、docs/CONTENT-STATUS.md。根据当前需求自行规划，不把历史对话的建议都当成已承诺功能。

## 必须保持
- 整词音频按 `resource` 独立仓库 → `resource://` 清单 → ResourceService 下载缓存 → AudioService 播放交付。不得以本地试听库或随包音频代替远程交付。已选标准见 `docs/VOICE-STANDARD.md`：Kokoro bf_emma 英式女声、speed=0.8。新音色须先核实分发条件并试听确认；Apple Flo 只作历史参考，不进入分发仓库。
- 微信原生小程序，MVP 本地优先；新增依赖应有实际需求。
- 内容只编辑 seed-data，再运行 npm run build:data。不要编辑生成文件。
- 页面不得硬编码教材、年级、单元或音素词表。新增教材通过 curriculum/index.json 注册。
- Word 与 Curriculum 解耦，同一个词只存一个实体；教材语境释义在 entries 内。
- IPA、音素和 grapheme 是不同概念。/kl/ 是两个音素，segment.phonemeIds 必须为数组，静音可为空数组。
- 自定义词与教材词复用 Word 模型；未审核内容不能自动变成 verified。
- 所有发音调用 AudioService。页面隐藏/卸载取消播放；快速连点不能叠音。
- AI 补齐的 IPA、音节、拼读及发音提示保留 pending。根据用户本轮反馈，开发版允许显示带“待教学核对”标记的 IPA 与音素入口；正式发布仍须核验，不能把 pending 改成 verified。
- 不复制第三方角色、教材插画、词典音频；新增素材必须记录来源和使用条件。
- 无来源、无审核或缺失的音频不能播放；不得用蜂鸣/字母名/TTS 读 IPA 代替音素。
- 用户已授权本地浏览器开发预览使用系统英式整词合成试听，必须标注试听且与正式 manifest 隔离；不得充当单音录音。渐变表示真实整词播放进度，无时间标注时不得声称精确音素同步。
- 2026-09-11 用户另行授权 AI 整词合成音用于小程序功能测试及资源分发。使用 synthetic-preview 和 pending 审核状态、记录模型及许可，页面标注“AI 合成试听 · 待发音核对”；不适用于音素、不自动成为 verified。
- 不记录儿童个人身份数据；首版本地存储，禁止默认上传。

## 完成标准
运行 npm run check。真实 UI 与音频变更在微信开发者工具/真机验证；无法验证时明确说明。保留用户改动，不擅自 push。当前源数据为 pending，不得宣传为已审核发布版。
