# 资源托管与缓存验证

## 当前方案：完整音频包安装（2026-09-12）

本节替代下文的逐词远程下载和单元预加载方案。当前清单中的 145 条 Emma MP3 打包为 `bundles/audio/words-8622c24fb2d33504.zip`（2,265,358 字节），解压后的媒体共 2,356,317 字节。ZIP 内保留 `SOURCES.json`，不打包旧音色、历史版本或技术样本。审核仍为 synthetic-preview / pending。

- 下载入口：单词/复习卡缺本地文件时显示“尚未下载音频”，点击进入 `pages/audio-download/index`；单元页和关于页也有入口。源音频尚未制作的音素显示“音频待补充”，不诱导重复下载。
- 下载页独占网络下载；显示下载、校验、安装和完成状态，支持取消、失败重试和单条失败日志。离开下载页取消未完成安装；安装后返回词卡自动重新检查。
- ResourceService 优先读取完整安装中的文件，其次复用旧版缓存。没有本地文件时返回 AUDIO_NOT_INSTALLED，不发起单文件下载；单元页不再自动预加载。
- ZIP 先校验整包大小和 SHA-1，再解压至 `USER_DATA_PATH/audio-bundles-v1/install-<sha1>-<generation>`；逐个校验媒体大小和摘要，全部通过后原子替换 active.json。安装失败不覆盖原来的安装。
- 安装文件以内容 SHA-1 + 扩展名命名，AudioService 沿用 `{path, release}` 租约。播放中的文件受保护；旧版本及未完成目录在后续安装时清理。整包不参与 FIFO 淘汰，不受旧版 100 文件限制。
- 本地数据清除、换设备或文件损坏后需要重新下载。新的资源包随应用清单更新；页面会根据当前音频哈希检查是否完整。不会在启动时自动联网更新。
- Gitee 仍可能重定向到登录页；整包只能减少请求并提供安装后的离线使用，不保证首次匿名下载必定成功。失败日志记录 ZIP 请求地址、返回信息和安装阶段。

构建与发布：

```sh
npm run resources:bundle -- --resource /path/to/resource
npm run check
npm run resources:verify -- --bundle --local /path/to/resource
# 先提交推送 resource 的新 ZIP 和来源说明，再验证远端：
npm run resources:verify -- --bundle
# 最后提交推送应用（包含 seed-data/audio-bundle.json 和构建数据）。
```

构建需要系统 zip 工具。固定文件顺序、时间戳和 ZIP 元数据；当前音频清单内容不变时输出一致。清单绑定包含来源和许可，变更音频清单后必须重新打包。ZIP 不进入小程序代码包。

本轮验证：resource 的 ZIP 与说明已推送至 `7fd3cd5`，本地 ZIP 摘要和 145 份解压媒体均通过校验。微信开发者工具已验证下载页、点击下载和失败提示；真实请求仍报 `url not in domain list`，桌面匿名请求返回 Gitee 登录 HTML。尝试通过工具传入本地 ZIP 验证原生安装时，遇到请求大小限制和包内文件访问限制，未完成微信原生成功安装/离线播放验收。临时测试 ZIP 已从应用目录移除，downloadFile mock 已恢复。安装成功、离线重启、失败保留旧版本、取消和缓存兼容由自动化测试覆盖，不能替代真机验收。

下文是历史阶段记录，涉及逐词网络请求、自动预加载或 100 文件容量的描述仅适用于旧版缓存。

## 当前方案：Emma 整词远程资源（2026-09-12）

用户选定 Kokoro A · Emma，bf_emma / speed 0.8。统一使用资源仓库 → `resource://` → ResourceService 下载缓存 → AudioService；批量生成和本地资源写入状态见 `VOICE-STANDARD.md`。新音频路径为 `audio/words/en-GB/kokoro-emma/v1/`，本地仓库根为 `/Users/lvzheng/Cursor/resource`。各单元通过教材注册表获取资源，同词共享文件。

更新音频必须同步资源仓库 manifest 与应用 seed-data 的版本路径、SHA-1、字节数，再构建数据。推送前用 `npm run resources:verify -- --local /Users/lvzheng/Cursor/resource` 检查；推送后用 `npm run resources:verify` 实取匿名 HTTPS。未发布的新路径不能视为已可下载，Gitee 间歇性 HTML 响应问题也不能以本地通过宣称修复。

浏览器默认读取同一清单的远端 URL；显式设置 `RESOURCE_PREVIEW_ROOT` 时才从本地资源仓库读取并核对摘要。两种方式都不注入 Flo，但浏览器不模拟原生微信文件缓存。真实缓存策略仍为 100 文件 / 8 MiB，不保证全部 145 个词同时留在缓存。

## 以下为此前操作记录

下文随包 Piper 和本地 Flo 是历史操作，不是当前标准；以本节及 `VOICE-STANDARD.md` 为准。

## 当前修复（2026-09-12）

后续试听反馈：26 条整词已改为保留音高的 0.75 倍慢速版（`v2-slow`），原版归档于包外的 `assets/source-audio`；下文 254 KiB 是首次打包原版的记录，当前体积以素材清单为准。浏览器其余系统试听从 135 调至 100 词/分钟，并更换临时缓存版本。播放进度在播放期间每 50ms 读取真实媒体时钟，去除 140ms CSS 过渡；停止、切词及结束清除采样计时器。仍为整词进度，无逐音时间标注，不能将其当作逐音同步高亮。

慢速版验证：26 文件共 333,437 字节，逐份通过 FFmpeg 解码和时长比例检查；gingerbread house 从 1.010068 秒变为 1.322812 秒。`npm run check` 通过 55 项测试与 13 页模板编译，新增测试覆盖稀疏事件下读取媒体进度、媒体时钟停滞及取消清理。浏览器可进入播放状态；此次修改后的原生微信体验仍需复测。

Unit 1 的 26 条已授权 AI 整词试听改为随小程序打包，共 260,397 字节（254 KiB），首次使用不再请求 Gitee。文件从本地 resource 仓库逐份核对大小及 SHA-1 后原样复制；种子清单登记包内路径，保留 synthetic-preview、pending、模型和许可。构建阶段验证包内文件大小和摘要。来源见 `assets/manifest.json` 与 `docs/UNIT-1-AI-AUDIO.md`。

本次桌面匿名获取 word_was.mp3 返回 HTTP 200、audio/mpeg，SHA-1 与清单一致；无法仅凭截图确定当次真机失败原因。此前已记录 Gitee 登录重定向及真机内容校验失败，因此本地优先 MVP 不再依赖该下载链路提供这 26 条试听。远程测试样本及缓存机制保留，远程托管稳定性未宣称修复。

播放区只保留一个主要播放动作；远程下载出错时显示浅色提示、重新加载按钮和透明背景的诊断入口。浏览器预览优先使用同一批包内音频，其余缺失整词仍使用隔离的本机系统试听。微信开发者工具和真机需重新编译验证包内 MP3、离线首次播放、切后台及快速连点。

验证：`npm run check` 通过，54 项测试及 13 页 WCC/WCSC 编译成功。新增回归验证 26 条整词的包内路径、离线资源解析、字节数及 SHA-1。浏览器实测 was 页面点击进入播放状态，结束后按钮恢复；原生微信播放及排版尚未在本轮验证。

## 当前结论（2026-09-11）

代码和本地验证已完成，**开发者工具已通过下载、缓存播放及重新编译后缓存复用；真机离线验收仍待完成**。Gitee 曾间歇性返回登录页，不能由本轮成功推断长期稳定。

- 资源仓库：`/Users/lvzheng/cursor/resource`；首个提交 `760f115`。
- 内容：一份 Denelson83 的真人通用 IPA `[i]` 参考录音，转成 MP3（8,195 B）和 WAV（26,602 B）。原始字节 SHA-1 与 Commons 页面一致；采用 CC BY-SA 3.0，保留署名、原始 OGG、许可链接及转换记录。
- 它不是完整英式音素库，不自动绑定 `/iː/`，听审/教学适用性仍待核对。技术样本只在 `seed-data/resource-samples.json`，正式学习数据不变。
- 两个本地媒体均通过 FFmpeg 解码和应用清单的大小/SHA-1 检查。
- 用户已推送资源，远端 master 提交已核对为 `760f1155110920ee1dac1c1637c6ccf131b855f9`。发布后两个格式曾同时通过匿名 HTTPS 大小及 SHA-1 验证。
- 2026-09-11 再次运行 `npm run resources:verify`：MP3 返回内容/大小不符，WAV 仍通过（26,602 B）。匿名获取结果不稳定，不能认定 Gitee raw 已满足资源托管要求。
- 微信开发者工具 Stable 2.02.2608070 / 基础库 3.17.3：压缩首页图正常显示；日志确认 `LazyCodeLoading: true`。测试页加载、缓存目录创建正常。用户修正 downloadFile 域名后，已刷新配置并重新编译；错误日志中的允许列表确认包含 `https://gitee.com` 和 `https://raw.giteeusercontent.com`。
- 13:35 的微信 MP3 下载仍失败：Gitee 返回 `302: /login?redirect_to_url=...i.v1.mp3`，随后报 `url not in domain list`。当前阻塞是登录页重定向，不能再归因于用户漏配这两个域名。后续 WAV 点击后 UI 捕获服务失败，结果未能读取。
- 13:45–13:48 复测：不携带 token/cookie，MP3/WAV 各连续三次下载均通过大小和 SHA-1 检查；正常链路为 gitee.com 的 302 跳转至 raw.giteeusercontent.com 的 200。这说明并非必须登录，早先登录页的触发条件仍未确定。
- 开发者工具复测：WAV 已成功入库；MP3 重试成功。缓存共 2 个文件、34,797 字节。两种格式技术试听均收到微信 onEnded，下载次数不变，命中从 0 增至 2。
- 重新编译后缓存仍为 2 个文件、34,797 字节；MP3 再次播放收到 onEnded，本次运行下载 0 次、命中 1 次，确认跨运行复用本地缓存。
- 真机首次下载、断网播放仍待验证。没有关闭合法域名校验，也没有将系统合成音上传。

## 开闭原则与接口

2026-09-11 改为 `https://raw.giteeusercontent.com/lvzheng1508/resource/raw/master` 直链：MP3、WAV 均在不携带签名参数或登录凭据时返回 HTTP 200，大小和 SHA-1 与清单一致。已替换资源根地址，绕过 gitee.com 页面入口；真机 MP3 恢复情况仍待验证。此前“跳转 URL 有签名参数”不代表该直链必须携带签名。

2026-09-11 用户真机反馈：WAV 下载成功并能听到发音；MP3 报“资源校验失败，请检查下载链接”。同时段桌面匿名下载两份文件均通过。MP3 问题发生在保存/解码前，不能据此判为 MP3 格式不兼容；手机实际响应内容仍待核对。真机重启、断网验证尚未确认。

调用链：页面 / 组件 → AudioService → ResourceService → URL provider + 微信文件适配器。

- `miniprogram/resource-config.js` 集中维护 Gitee raw 根地址及音频容量配置。
- manifest 使用 `resource://audio/.../file.v1.mp3`，同时登记 `sha1`、`bytes`、`extension`、来源与许可。正常教学内容还需 reviewer 和 verified。
- 换静态托管：只改 `baseUrl`。以后换成带签名地址的服务：替换 provider 和资源层装配；各页面、AudioService 不需要感知供应商。
- AudioService 取得 `{path, release}` 租约，播放结束/错误/取消释放；迟到的下载结果不能恢复已取消的播放。
- 原有本地打包路径和浏览器试听路径继续支持；远程受管理资源使用 `resource://` 才进入持久缓存。不要向页面添加直接 URL 下载。
- 通用缓存支持 mp3/wav/jpg/png；未来图片缓存另建 namespace 与容量配置即可。当前图片仍在包内，不引入图片网络依赖。

## 缓存规则

## 单元预加载（2026-09-11）

- 用户确认只使用真人录音，缺少的暂不启用。Unit 1 共 26 个词条；当前正式音频仍缺失，不把通用 [i] 样本或合成音绑定到教材词条。
- 进入单元页按 ContentService 的单元关系收集可播放的 resource 音频，使用统一 ResourceService，后续新增单元不改页面逻辑。
- 单设备同时最多 1 个预加载任务；上次结束后至少等待 1 秒。播放处于 loading/playing 时不启动新预加载；已在途下载不强制中断，主动播放可能等待这一份下载完成。
- 切后台不启动后续任务，回前台继续；切换单元丢弃旧单元剩余队列。连续 3 次失败暂停本次单元自动任务，单词页仍可主动重试。没有无限自动重试。
- 现有 100 文件 / 8 MiB FIFO 约束仍适用。页面“本次预加载已就绪”是本轮成功计数，不承诺文件永不被淘汰。
- 频控在当前设备生效，多用户访问的总 QPS 仍会累加。
- 本轮 village 的 Commons 原始文件请求被连接重置；没有取得新录音，也没有将未听审的资源标为 verified。26 条真人音频的初始化与真机单元批量下载仍未完成。

- 使用微信 `USER_DATA_PATH` 下的 `resources-audio-v1` 目录，存媒体文件及索引；不是把所有媒体加载进 JavaScript 内存。
- 本项目策略：最多 100 个音频且总计不超过 8 MiB，**不是微信平台额度声明**。
- FIFO；命中不改变入库顺序。正在播放的文件受租约保护，淘汰最早未被使用的文件；全部占用时明确报错。
- 并发申请串行入库，同资源后续申请命中缓存，避免重复下载/淘汰竞争。
- 内容 SHA-1 + 扩展名作为文件身份；切换服务器不失去已缓存内容。内容改变必须更新版本文件及清单哈希/字节数。
- 每次使用检查文件存在、大小和摘要；HTTP 错误或返回 HTML 登录页不得缓存。SHA-1 用于文件一致性校验，不用于授权或数字签名。
- 重启加载索引，清理未入索引的孤儿文件。损坏索引不能引用/删除缓存目录之外的用户数据。写入失败明确报错，不伪装成功。
- 下载次数/命中次数为本次运行计数，文件本身跨重启保留。取消播放不取消已经开始的下载，下载成功后可供下一次使用。

## 完成真实验收

1. 资源已发布；后续资源更新仍需先推送再验收。
2. 在应用目录执行 `npm run resources:verify`。必须看到两个匿名 HTTPS 的 PASS；404/403/HTML 校验失败均不算通过。
3. **downloadFile 合法域名**已加入 `https://gitee.com` 和 `https://raw.giteeusercontent.com`。正常 raw 请求会跨域跳转；不要把带临时签名的跳转 URL 固化进配置。登录页重定向需解决匿名资源可用性，增加域名不能代替这一验证。
4. 微信开发者工具刷新域名信息并重新编译，保持域名校验开启。
5. 首页 → 关于拼读星球 → 开发验证：音频下载与缓存。清缓存后下载 MP3，再点下载/试听，确认下载次数不增加、命中增加；WAV 同样测试，并听辨首尾是否完整。
6. 重启小程序后重复试听，再在真机断网重复试听；应从本地读取。快速切换、离开页面、停止播放不得叠音或迟到发声。
7. 本地缓存逻辑的 100 文件及容量上限由自动化测试验证；真机再观察资源清理、重启和存储不足错误处理。

本地验证命令：`npm run resources:verify -- --local /Users/lvzheng/cursor/resource`。这只检查本地文件，不替代步骤 2–6。

## 图片处理

原 PNG 1,629,901 B → 900×600 JPEG 73,188 B，缩减约 95.5%。首页保持包内加载；原 PNG 位于 `assets/source-images/`，不进入小程序包。组件按需注入已启用。

## API 参考

- https://developers.weixin.qq.com/miniprogram/dev/framework/ability/file-system.html
- https://developers.weixin.qq.com/miniprogram/dev/api/network/download/wx.downloadFile.html
- https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.getFileInfo.html
- https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts （核对实际参数类型）

## 2026-09-12 Emma 与逐词时间表

当前全六单元 145 词通过 resource:// 分发，resource 已推送 `6392fd6` 与 `669f159`。136 条使用 Emma v1，9 条读法修正使用 v2-aligned，旧版本保留，缓存按新路径和摘要更新。前文 Piper 慢速与无时间表为历史阶段。

详情与复习按 currentTime 和音频摘要绑定的时间表推进音标；重音、静音不参与均匀字符分配。时间表为机器估计、待人工核对，77 个内部边界使用模型时长插值。检查记录见 `../artifacts/audio-sync-audit-2026-09-12/README.md`。

## 单条失败诊断

`resource.error` 汇总同一次下载的 requestId、单词、requestUrl、失败阶段、HTTP statusCode、contentType、contentLength、可见的 Location、网页摘要、预期/实测大小和 SHA-1、原生错误码及具体错误。请求尚未收到响应时相应字段为 null；微信未暴露的重定向信息不猜测。网页只取有限长度的文本，读取失败也写进同一条记录。URL 查询参数及凭据继续脱敏。

诊断页可点“复制这条失败日志”，无需拼接前后的下载记录。汇总应用于更新后的新请求，不能补全旧日志里未保存的响应信息。
