# Next Step 项目改进清单

审查日期：2026-07-05

审查范围：React/Vite 前端交互层、消息/输入/弹窗/预览组件、Gemini API 服务封装、本地同步服务 `server.cjs` 与 `backend/sync-server.cjs`、IndexedDB 与同步逻辑。

验证动作：

- 已检索现代 Web 指南，参考方向为可访问性、表单反馈、长内容渲染性能。
- 已运行 `.\node_modules\.bin\tsc.cmd --noEmit`，当前 TypeScript 静态检查未通过。

## 总体判断

项目功能面很完整，问题主要不在“缺功能”，而在三个基础面：

1. 前端交互已经变复杂，但焦点管理、可访问性、长内容性能和预览隔离还没有形成统一底座。
2. 后端/同步服务目前更像本地开发便利工具，认证、路径校验、并发写入、数据一致性边界不足。
3. Gemini SDK、模型能力配置和本地类型定义已经出现漂移，导致项目不能通过 `tsc --noEmit`。

建议先处理 P0 项，确保项目回到“可编译、可信边界清晰、核心交互可键盘操作”的状态，再做体验优化。

## P0：必须优先处理

### 1. 恢复 TypeScript 基线

当前 `tsc --noEmit` 失败，说明类型系统无法继续作为变更保护网。主要错误集中在：

- `App.tsx` 传入 `ChatAreaProps` 的 `onEditMessageContent` 签名不一致：实际是 `(messageId, newContent)`，类型声明是 `(message)`.
- `thinkingLevel` 在多处被声明为 `'LOW' | 'HIGH'`，但业务常量已经支持 `'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH'`。
- 本地安装的 `@google/genai` 类型不再导出 `ChatHistoryItem`，且 `Candidate.toolCalls`、`UsageMetadata.candidatesTokenCount` 等字段与当前代码不匹配。
- `constants/themeConstants.ts` 使用了 `Theme`，但没有导出该类型，导致 `SettingsModal.tsx` 与 `utils/uiUtils.ts` 报错。
- `utils/export/image.ts` 存在重复 `triggerDownload` 标识符。
- `hooks/core/useSyncManager.ts` 的 setter 类型和实际调用方式不一致。

建议：

- 先建立 SDK 适配层，集中定义项目自己的 `ChatHistoryItem`、usage metadata 兼容读取、tool metadata 兼容读取。
- 统一 `ThinkingLevel` 类型，不要在组件、service、constants 中各自手写 union。
- 在修复上述错误后，再考虑逐步打开 `strict`，当前 `allowJs: true`、大量 `any` 会削弱类型保护。

### 2. 修复弹窗与焦点管理

`components/shared/Modal.tsx` 目前只有 `role="dialog"`、`aria-modal="true"`、Escape 关闭和背景点击关闭，但缺少：

- `aria-labelledby` / `aria-describedby` 的统一传入。
- 打开后初始焦点定位。
- Tab / Shift+Tab 焦点陷阱。
- 关闭后焦点恢复到触发按钮。
- 背景内容 inert 或等效隔离。

受影响区域包括设置、确认、文件预览、HTML 预览等。建议把 `Modal` 升级为统一对话框底座，再逐个补齐标题 id 与描述 id。

### 3. 修复键盘焦点可见性

多处按钮使用 `focus:outline-none`，但没有可靠的替代样式。另有明显拼写问题：

- `constants/appConstants.ts` 中 `CHAT_INPUT_BUTTON_CLASS` 使用了 `focus:visible:ring-*`，应为 `focus-visible:*`。
- `components/header/HeaderModelSelector.tsx`、`components/sidebar/HistorySidebar.tsx` 也出现 `focus:visible`。
- `components/chat/message-list/ScrollNavigation.tsx`、`components/modals/FilePreviewModal.tsx`、`components/log-viewer/ObfuscatedApiKey.tsx` 等按钮移除了 outline，但焦点反馈不足。

建议建立一套共享按钮焦点类，所有图标按钮复用，保证键盘用户能看见当前位置。

### 4. 调整流式消息的无障碍播报

`components/chat/MessageList.tsx` 把整个滚动容器设置为 `aria-live="polite"`。流式输出时，容器内容频繁变化，屏幕阅读器可能持续播报大量文本。

建议：

- 移除消息列表整体 live region。
- 增加集中式 `polite` / `assertive` live region。
- 只播报关键状态：开始生成、生成完成、上传失败、API 错误、同步完成等。
- 对持续变化的 token、计时、流式文本不要直接放入 live region。

### 5. 加固同步服务认证、CORS 与路径校验

`backend/sync-server.cjs` 当前默认：

- `host: '0.0.0.0'`
- `Access-Control-Allow-Origin: '*'`
- WebSocket 客户端只要发送 `REGISTER_SYNC_CLIENT` 即可注册。
- `/api/sync/pull`、`/push`、`/delete` 没有认证。
- `type`、`id`、`data.id` 直接参与 `path.join(...)` 文件路径拼接。

建议：

- `type` 限制为固定枚举：`session`、`groups`、`settings`、`scenarios`。
- 所有文件路径用 `path.resolve` 后校验必须位于 `storage` 或 `storage/sessions` 内。

### 6. 改造同步写入的一致性与限流

同步服务现在直接 `fs.writeFile(filePath, JSON.stringify(...))`，并允许 `express.json({ limit: '200mb' })`。风险包括：

- 并发 push 时互相覆盖。
- 写入中断可能留下半截 JSON。
- 200MB JSON 请求容易造成内存尖峰。
- large file 通过 base64 `syncData` 进 JSON，会进一步放大体积。

建议：

- 写临时文件后 `rename`，保证原子替换。
- 增加 revision/hash，避免无感覆盖。
- 大文件不要内嵌到 JSON，同步为独立 blob 文件或可选跳过。

## P1：近期体验与可靠性优化

### 8. 长消息列表性能需要真正虚拟化或分段渲染

`hooks/useMessageListUI.ts` 当前用 `visibleMessages` 加 placeholder 模拟懒渲染，但消息一旦可见就永久留在 Set 中，长会话最终仍会保留大量 DOM。`estimateMessageHeight` 也是粗估，复杂 Markdown、代码块、图片、图表会导致滚动跳动。

建议：

- 引入真实虚拟列表方案，或按消息块分段卸载。
- 若使用 CSS `content-visibility: auto`，必须配套 `contain-intrinsic-size`，且只用于首屏以下的大块内容。
- 对键盘线性导航做验证，避免 offscreen 内容不可达。
- 流式中的最后一条消息不要虚拟化，优先保证稳定滚动和选择文本。

### 9. 文件上传进度与取消语义不一致

`services/api/fileApi.ts` 使用 SDK 上传文件，但 SDK 路径没有真实 progress，完成后才回调 100%。`AbortSignal` 也只在上传前和 catch 后检查，用户点击取消时请求本身未必真的中断。

建议：

- UI 上明确区分“正在请求上传”和“可取消上传”。
- 若要保留进度条，改为可观测的上传实现；否则用 indeterminate loading。
- 取消后需要确认真实请求是否停止，不能只改本地状态。
- 上传失败、处理中、超时后提供重试入口。

### 10. Blob URL 生命周期需要集中管理

项目多处使用 `URL.createObjectURL`：文件预览、生成图片/音频、Token 统计、导出、SidePanel 下载等。已有部分 revoke，但不完整。

建议：

- 建立统一 helper：创建、下载、预览、释放都经过同一个模块。
- 对消息中的生成媒体，在消息删除、会话切换、清空历史、组件卸载时统一释放。
- 下载型 URL 在触发下载后立即或延迟 revoke。
- 给长时间会话增加内存回归测试。

### 11. 表单与输入控件的标签、错误提示需要统一

现代 Web 指南强调：不要只依赖 placeholder，动态错误要关联到控件。当前多处输入有 placeholder，但标签和错误关联不统一，例如搜索、API key、File ID、URL、Token 统计、模型编辑等。

建议：

- 输入控件使用可见 label 或 `aria-labelledby`。
- 帮助文本和错误文本使用 `aria-describedby`。
- 校验时机按 input 清错、blur/submit 展示错误。
- 必填项使用原生约束或明确文本，不只靠颜色。

### 12. 国际化存在硬编码英文

项目已有 `utils/translations`，但仍有不少硬编码英文 UI 文案：

- Header 的 Pull/Push title 与 aria-label。
- HTML Preview、SidePanel、Mermaid/Graphviz 按钮。
- FilePreview 的 Previous/Next、Invalid YouTube URL。
- Log viewer 搜索、Filename、Preview not available 等。

建议新增一次 i18n 扫描，把用户可见字符串全部迁移到翻译表。

### 13. 移动端与密集工具栏需要降噪

Header 和 ChatInput 聚合了模型、同步、PiP、工具、场景、翻译、录音、发送等动作。桌面可接受，移动端容易拥挤。

建议：

- 移动端把低频动作收进 overflow menu。
- 桌面保持布局现状。
- 同步按钮增加明确状态文本或 tooltip，不只靠图标变化。
- 所有触控目标保持至少 44px，关键输入与底部安全区保持稳定。

## P1：后端处理逻辑优化

### 14. API 终止状态需要单一路径

`services/api/chatApi.ts` 的流式请求在 catch 中调用 `onError`，finally 中仍会调用 `onComplete`。目前 UI 可能依赖 `isLoading` 避免覆盖错误，但终止状态分散会增加竞态。

建议：

- 明确 `success`、`abort`、`error` 三种 terminal state。
- `onComplete` 只在成功或可控 abort 时触发。
- 统一错误分类：网络、认证、配额、模型不支持、内容安全、空响应。
- 对可重试错误提供指数退避，非幂等请求谨慎重试。

### 15. 同步冲突策略过于简单

`hooks/core/useSyncManager.ts` 基于 `updatedAt` 做 last-write-wins。删除只支持 session，且没有 tombstone。多设备同时编辑时容易静默覆盖。

建议：

- 增加 revision/hash 和 lastSyncedAt。
- 删除写 tombstone，避免被旧设备重新推回来。
- settings、groups、scenarios 分别定义 merge 策略。
- 冲突时至少记录日志并给用户选择。

### 16. 同步 metadata 每次全量扫 JSON

`SyncService.getMetadata()` 每次读取 sessions 目录下所有 JSON 并 parse。会话多、文件大时会拖慢同步。

建议：

- 维护 `metadata.json` 索引。
- 每次 save/delete 时增量更新索引。
- metadata 返回 hash、updatedAt、size，前端按需拉取。

### 17. API key 使用统计不应保存明文 key

`utils/apiUtils.ts` 会调用 `logService.recordApiKeyUsage(key)`，`services/logService.ts` 把 API key 作为 `Map` key 存到 localStorage 的 `chatApiUsageData`。

建议：

- 改为保存 key 指纹，例如前后 4 位加 hash。
- 日志序列化时统一脱敏 API key、Authorization header、proxy URL 中的凭据。
- Log viewer 默认隐藏敏感字段，导出日志也应脱敏。

### 18. 模型目录和能力矩阵需要集中治理

`constants/modelConstants.ts`、`services/api/baseApi.ts`、`services/api/generation/textApi.ts`、上传/媒体分辨率逻辑都在判断模型能力。现在已经出现 SDK 类型漂移，后续模型能力变化会继续放大维护成本。

建议：

- 建立单一 model registry，字段包括文本、图片、TTS、Live、thinking、tools、mediaResolution、imageSize、aspectRatio 等能力。
- UI、请求构建、校验、默认值都读取 registry。
- 静态常量保留 fallback，但支持从服务端或 provider 元数据刷新。

## P2：工程质量与测试

### 19. 增加最小自动化测试

建议优先补这些测试：

- `buildContentParts`：文本、图片、视频、YouTube、Files API、mediaResolution、thoughtSignature。
- `sync-server`：type/id 白名单、路径穿越拒绝、原子写入、delete tombstone。
- `apiUtils`：多 key 解析、轮询、locked key fallback、脱敏。
- `chat-stream/processors`：文本、thought、tool result、inlineData、空响应、abort。
- `Modal` 与 ChatInput 的 Playwright 键盘测试。

### 20. 增加可访问性与视觉回归检查

建议加入：

- Playwright + axe 对主要页面、设置弹窗、文件预览、HTML 预览做 smoke audit。
- 键盘只用 Tab/Shift+Tab/Escape/Enter 操作一遍核心流程。
- 移动端视口截图检查 Header、输入区、弹窗底部安全区。
