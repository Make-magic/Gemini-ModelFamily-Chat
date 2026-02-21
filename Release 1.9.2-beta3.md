feat: Release 1.9.2-beta3

# 局域网多端同步方案工程化加固 (Release 1.9.2-beta3)

本版本在 Beta 2 的基础上，重点解决了项目使用 `pkg` 打包为单一 EXE 后的物理持久化、端口自适应以及超大数据量同步的鲁棒性问题。

### 1. 单一 EXE 打包与物理路径逃逸 (Pkg Support)
- **环境感知存储**: 修改 `backend/local-server.cjs`，自动识别 `process.pkg` 环境。打包后，数据目录 `storage/` 将自动建立在 EXE 执行文件同级物理目录，解决虚拟挂载点只读导致的写入失败。
- **VFS 资源隔离**: 确保静态网页资源（dist/）在打包后依然能从 EXE 内部 Snapshot 正确加载，实现 UI 与 API 的完美解耦。
- **生产环境入口优化**: 改进 `server-entry.cjs`，在启动时自动探测环境并引导浏览器访问 `localhost`，增强了防火墙兼容性。

### 2. 环境自适应与端口感知 (Smart Port Sensing)
- **严谨环境判定**: 引入 `import.meta.env.DEV` 代替模糊的端口猜测逻辑。
- **双模式运行**: 
  - **开发模式**: 强制后端同步 API 指向 `8889` 端口，彻底修复了 `npm run dev` 时因误连 3000 端口触发的 `SyntaxError: Unexpected token '<'`。
  - **生产模式**: 自动跟随当前 UI 端口，确保在不同局域网 IP 访问时同步功能依然可用。

### 3. 高吞吐量同步与原子化容错 (High-Capacity Sync)
- **后端吞吐量提升**: 将 `/api/sync/push` 接收限制从 50MB 提升至 **200MB**，支持同步包含多张高清内嵌图片的复杂会话。
- **推送流程解耦**: 重构 `pushToServer`。现在每个会话的推送均具备独立的 `try-catch` 容错。单个过大会话的失败不再阻塞 `groups.json`, `settings.json` 及 `scenarios.json` 的关键配置推送。
- **精细化反馈**: 增强了同步成功/失败的计数统计，控制台及前端日志能准确反馈部分同步成功的情况。

### 4. 核心功能延续 (Inherited from Beta 2)
- **二进制数据重水化**: 完善了 Base64 与 Blob 的互转协议，确保内嵌多媒体文件跨端预览有效。
- **强制覆盖合并**: 针对场景预设和群组文件夹结构，实行“中心优先”策略，确保跨设备 UI 表现高度一致。

### 修改的文件清单：
- **Backend**: `backend/local-server.cjs`, `backend/server-entry.cjs`, `backend/cloud-client.tsx`
- **Hooks**: `hooks/core/useSyncManager.ts`, `hooks/app/useAppLogic.ts`, `hooks/chat/useChat.ts`
- **Config**: `package.json`
- **Docs**: `Release 1.9.2-beta2.md` (Updated & Renamed to Beta 3)
