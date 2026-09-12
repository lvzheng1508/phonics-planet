# 技术落地约定

原生微信小程序（JS/WXML/WXSS），本地 JSON → 构建模块，无运行时 npm 依赖。miniprogramRoot 指向 miniprogram/。最低基础库兼容性由后续开发者工具验证，不在此捏造版本兼容结论。

## 模块
- AudioBundleService：完整音频包下载、校验、解压与持久安装；失败保留原安装，已安装文件不参与 FIFO。ResourceService 只读取本地安装和旧缓存，学习页面不再触发单词下载。
- ContentService：读取生成数据、教材列表、单元/词/音素检索。页面只通过服务读取内容。
- StorageService：带版本命名空间的收藏存取，去重和损坏数据回退；存储写入失败交给页面提示。
- AudioService：唯一 InnerAudioContext 所有者；顺序播放、快速切换取消、结束/错误/超时清理；隐藏和卸载停止。只播放审核完成的资源，不将拆音串播放描述为自然连读。
- audio-button：统一调用服务的展示组件。

## 当前实现边界
路由、浏览、收藏已接通；整词使用用户选定的 Emma 合成试听资源，经 resource:// 远程下载与缓存；音素资源尚缺，正常显示准备提示。缺 ID/缺音频/未审核数据有降级。练习和复习等后续任务由 AI 根据产品目标自行拆分，不固定假期开发排期。

## 验证
npm run check：源数据完整性 → 构建数据 → Node 服务测试 → JS/页面文件静态校验。
手工：用真实 AppID 导入，浏览 7 页；六上单元 1–6 和长专名换行；收藏后重启保留；未知 id 空态；检查 IPA 字体；接入审核音频后验证静音键行为、连续点击、切后台、加载失败、播放结束与真机延迟。

## 新增内容
修改 seed-data，运行 check；新增教材注册 index；音频资源放 miniprogram/assets/audio 或合法 HTTPS 域名，填 manifest 来源/许可/审核人。远程地址还需开发者工具配置合法域名。较多音频后评估分包/远程缓存与体积预算。

音标跟读：ContentService 校验时间表的音频摘要、IPA 与非重叠区间；详情和复习将 AudioService 的 currentTime 传给 progressTokens。服务每 50ms 读取媒体时钟，在结束、停止和切词时清理采样。离线对齐方法与逐词结果见 `artifacts/audio-sync-audit-2026-09-12/README.md`，模型和 Python 不进入运行时。
