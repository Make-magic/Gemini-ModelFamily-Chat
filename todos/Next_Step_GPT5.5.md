# Next Step 项目改进清单

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
