feat: 实施局域网多端数据同步方案 (LAN Multi-device Sync)

实施了完整的 Client/Server 同步架构，支持多个浏览器客户端之间手动同步设置、聊天会话、群组结构及场景预设。

核心变更：

1. 后端数据中枢 (backend/local-server.cjs):
   - 新增 `SyncService` 模块，负责 `storage/` 目录下文件的原子化读写。
   - 实现 `/api/sync/metadata` 等一系列同步 API，支持增量对比判定。
   - 改进 `getMetadata` 逻辑，引入文件系统 `mtimeMs` 作为版本凭证，解决旧数据时间戳缺失问题。
   - 升级 WebSocket `ConnectionRegistry`，通过身份注册区分代理客户端与同步客户端，确保广播安全。

2. 前端同步引擎 (hooks/core/useSyncManager.ts):
   - 实现手动控制的 `Pull from Server` 和 `Push to Server` 独立逻辑。
   - 采用“最后写入获胜 (LWW)”策略处理数据冲突。
   - 引入 `isHistoryLoaded` 状态协调逻辑，杜绝本地加载与远程同步之间的竞争条件 (Race Condition)。
   - 增强合并算法，确保跨设备同步后能够完美恢复群组文件夹层级关系及用户自定义场景。

3. 数据模型与持久化 (types/ & utils/db.ts):
   - 为 `AppSettings`, `SavedChatSession`, `ChatGroup`, `SavedScenario` 增加 `updatedAt` 时间戳字段。
   - 升级 `dbService` 支持同步元数据存储。
   - 修复 `rehydrateSession` 中因 JSON 序列化导致 Blob 对象失效而触发的 `URL.createObjectURL` 类型错误。

4. UI 界面更新 (components/header/Header.tsx):
   - 在顶部导航栏新增 `DownloadCloud` (拉取) 和 `UploadCloud` (推送) 两个功能按钮。
   - 实现独立的同步状态反馈（旋转动画、成功勾选、错误警告）。
   - 按钮 Tooltip 实时显示上次同步/拉取成功的精确时间。

5. 修复与优化:
   - 修复了 `Header.tsx` 引用不存在图标导致的白屏问题。
   - 修复了场景预设同步后无法在列表中显示的逻辑缺陷。
   - 同步更新了 `Convert_C2S.md` 实施规范文档。
