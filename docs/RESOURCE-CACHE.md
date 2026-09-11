# 资源托管与缓存验证

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
