feat: 局域网多端同步方案加固版 (Release 1.9.2-beta2)

本版本核心解决了内嵌模式下多媒体文件的跨设备同步问题，并全面优化了手动同步的操作透明度与逻辑鲁棒性。

### 1. 内嵌多媒体文件同步 (Binary Object Persistence)
- **推送侧增强**: 在会话导出为 JSON 报文前，自动将会话中存储于 `rawFile` 的 `Blob/File` 对象转换为 Base64 字符串，存储在 `syncData` 字段中。
- **拉取侧重水化**: 接收端下载 JSON 后，自动识别 `syncData` 并利用 `base64ToBlob` 还原为真实的浏览器 `Blob` 对象，确保 `URL.createObjectURL` 能够恢复图片、音频及 PDF 的预览。
- **持久化闭环**: 还原后的 `Blob` 对象同步写入本地 IndexedDB，实现“一次上传，全端可见”。

### 2. 手动同步逻辑重构 (Granular Control)
- **解耦拉取与推送**: 废弃原有单一同步按钮，在 Header 顶层实现独立的 `Pull from Hub` (下载) 与 `Push to Hub` (上传) 操作。
- **强制合并策略**: 针对 `Scenarios` 和 `Groups` 等数组数据，实行“信任元数据”的全量覆盖合并，解决了自定义场景拉取后不显示的 Bug。
- **同步判定优化**: 引入双重校验机制，对比逻辑优先使用 `updatedAt`，若缺失则回退至 `timestamp` 或后端文件系统的 `mtimeMs` (修改时间)。

### 3. 稳定性与竞态修复 (Race Condition Fixes)
- **状态锁控制**: 引入 `isHistoryLoaded` 标志位。只有在本地 IndexedDB 数据加载完毕后，才允许执行同步操作，彻底防止了空状态误推送。
- **防御性导出**: 修复了 `useChat.ts` 中缺失的 `setSavedSessions` 和 `setSavedGroups` 导出，解决了拉取时触发的 `TypeError: ... is not a function` 崩溃。
- **健壮性校验**: 在 `rehydrateSession` 中增加 `instanceof Blob` 校验，防止非法数据导致页面渲染失败。

### 4. UI/UX 体验升级
- **双按钮交互**: Header 右侧操作区新增 `DownloadCloud` 和 `UploadCloud` 图标按钮。
- **实时状态反馈**: 实现了独立的旋转动画（同步中）、绿色勾选（成功）及红色警告（失败）视觉反馈。
- **操作回溯**: 按钮 Tooltip 现在会实时显示该方向上一次同步成功的精确时间。

### 修改的文件清单：
- **Backend**: `backend/local-server.cjs`
- **Hooks**: `hooks/core/useSyncManager.ts`, `hooks/app/useAppLogic.ts`, `hooks/app/useAppProps.ts`, `hooks/chat/useChat.ts`, `hooks/chat/useChatState.ts`, `hooks/chat/history/useSessionLoader.ts`, `hooks/chat/useChatHistory.ts`
- **UI Components**: `components/header/Header.tsx`, `components/layout/ChatArea.tsx`, `components/layout/chat-area/ChatAreaProps.ts`
- **Utilities**: `utils/chatHelpers.ts`, `utils/fileHelpers.ts`
- **Types**: `types/chat.ts`, `types/settings.ts`
- **Docs**: `Convert_C2S.md`
