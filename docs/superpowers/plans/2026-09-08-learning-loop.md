# 学习闭环 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Independent source research and final review may use bounded subagents; implementation remains in the controller session because the services and page contracts are tightly coupled.

**Goal:** 将骨架推进为可实际操作的本地学习版本，完成查词、逐音展示/播放机制、收藏与自定义词、今日学习、翻卡复习及有内容门槛的基础练习。

**Architecture:** 原生小程序保持无运行时依赖；ContentService 统一内容视图，StorageService 单次写入保存用户状态，LearningService 生成今日任务与复习队列，PracticeService 从可审核追溯的内容出题。AudioService 暴露播放状态与片段索引，页面不持有音频实例。公开音频按实际可取回和核验结果接入。

**Tech Stack:** JavaScript、WXML、WXSS、Node 内置 test、离线 JSON。

**Spec:** PRODUCT.md、DATA.md、DESIGN.md、IMPLEMENTATION.md，以及用户认可的三阶段开发方式。

## Global Constraints

- 内容只编辑 seed-data，运行 npm run build:data 生成运行时数据。
- Word 与 Curriculum 解耦；保留单元语境，不将 read 的不同读音覆盖到一个字段。
- AI 生成的拆分保持 pending；来源核验、结构检查与人工听辨是不同状态，不自动假定人工审核完成。
- 无许可/缺失音频不能进入学习播放；通用 IPA 语音学示范不能假冒 en-GB 音素。
- 用户数据只在本地存储；读损坏状态降级，写失败明确提示且不推进 UI。
- 每阶段提交可回退；本轮无需发布或 push。

## Task 1: 状态与学习服务

Files: miniprogram/services/{storage-service,content-service,learning-service,practice-service,audio-service}.js; tests/learning.test.cjs; tests/audio.test.cjs.

Interfaces: storage snapshot()/favorites()/toggle(id)/addWord(text,meaning)/setSelection(curriculumId,unitId)/recordVisit(id)/review(id,rating,token)/recordAnswer(questionId,correct,token); content createContentService(data,storage), words(query), detail(id,context), unitWords(curriculumId,unitId), audioReady(id); learning.today() and reviewQueue(); practice.createSession(type,wordIds,seed).

- [x] 写行为测试：自定义词规范化与去重；写入失败不推进；日界线、重复答案幂等、复习间隔；语境释义；不可用内容不能出听音题；同形异音不产生多解题。

```js
assert.equal(storage.addWord('  Moon  ', '月亮').id, 'word_moon');
assert.equal(storage.review('word_moon', 'known', 'session:0').dueAt, '2026-09-09');
assert.equal(storage.review('word_moon', 'known', 'session:0').dueAt, '2026-09-09');
```

- [x] 跑 `node --test tests/learning.test.cjs tests/audio.test.cjs` 确认新增契约尚未实现。
- [x] 实现服务。原有 favorites key 只读迁移，整合状态写入 `phonics-planet:user:v2`；间隔 1/3/7/14 天，“再练练”重置为次日；切换播放取消旧会话，播放事件带 owner 与 index。
- [x] 覆盖音频取消、迟到事件、停播异常、超时；运行服务测试；最终随集成验证一起提交。

## Task 2: 原生页面闭环

Files: miniprogram/pages/*, components/audio-button/*, app.json/app.wxss, tests/pages.test.cjs.

Interfaces: 页面经上述服务取视图，不直读 JSON；详情传 curriculumId/unitId 保留语境；复习和练习使用 session token 防止连点重复计数。

- [x] 写控制器行为测试：未知 ID 空态；教材选择→单元→词条语境；添加自定义词→收藏→复习；翻卡前不能评分；重入页面读真实持久化状态。
- [x] 实现首页真实计数、最近学习、三大入口；教材/单元搜索；音素分类与关联词；单词整词/逐音/拼读对齐；可取消的播放按钮和播放索引高亮。
- [x] 实现我的单词搜索/添加、今日任务、翻卡复习和三类练习入口；内容未就绪时解释缺口并提供可用的浏览/复习入口。
- [x] 统一薄荷/暖白视觉与原创首页素材；长专名换行、44px 触控、错误态。
- [x] 执行页面控制器测试与 WXML 编译检查（如能获取官方编译器），记录真机未验部分。

## Task 3: 来源、数据验收与交付

Files: seed-data/learning-samples.json, seed-data/audio-manifest.json, docs/{SOURCES,AUDIO,CONTENT-STATUS}.md, scripts/*, README.md.

- [x] 为少量代表词建立来源清楚的 IPA/对齐候选；未人工核验的字段保留 pending。
- [ ] 下载许可清楚的公开 en-GB 单词音频，保留作者/许可/来源/文件校验值；只有满足播放条件的数据才进入运行时。
- [x] 数据校验区分结构完整性与发布就绪度，生成明确的缺口报告。
- [x] 跑 `npm run check`，独立审查关键状态和页面集成，修复问题。
- [x] 更新 README/内容状态/交接记录；将工作提交同步回 /Users/lvzheng/cursor/phonics-planet 的 feat/learning-loop，不推送远程。

## 执行记录

- 已核对 HEAD 与 origin/main 的 tree 完全一致；在 feat/learning-loop 合并两套历史，无内容冲突。
- 基线 7 项测试通过。
- 用户选择公开许可音频优先。机器暂无已确认的微信开发者工具；真机验收不能假定通过。

- 完成服务、11 个页面与开发预览；26 个行为测试及 WCC/WCSC 编译通过。
- 独立审查指出存储读取异常可能覆盖旧记录；已修复并增加回归测试。
- 6 个 IPA/对齐候选与 12 个录音调查候选已入库，均隔离于运行时。音频下载因连接重置受阻，未试听、未标记 verified。该项仍未完成。
- 浏览器已验证收藏、自定义词、翻卡评分、次日复习日期、计数、搜索与禁用状态；微信开发者工具/真机仍未验。
- 三项实施工作的代码一起完成集成验证后提交；不把未完成的素材审核记作开发完成。
