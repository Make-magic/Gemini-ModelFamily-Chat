# TODO: 局域网多端同步方案 (LAN Multi-device Sync)

## 核心目标
基于现有项目结构（React + Vite 前端，Express + WebSocket 后端代理），为了实现多端数据一致性（Chat History, Settings, Scenarios 同步），将 `local-server.cjs` 升级为局域网数据中枢（Data Hub），通过“Hub-and-Spoke”架构打破浏览器 IndexedDB 的孤岛限制，实现设置、历史记录和场景预设在多设备间的一致性。

---

## 阶段 1：后端存储基础设施升级 (`local-server.cjs`)
- [ ] **磁盘存储设计**: 
    - 在项目根目录创建 `storage/` 文件夹（建议 gitignore）。
    - 结构预设：`storage/settings.json`, `storage/scenarios.json`, `storage/sessions/` (按会话 ID 存储)。
- [ ] **数据持久化模块**:
    - 实现轻量级文件读写逻辑（使用 `fs/promises`），确保写入的原子性。
- [ ] **同步 API 路由开发**:
    - `GET /api/sync/pull`: 全量获取后端备份，用于新设备初始化。
    - `POST /api/sync/push`: 接收前端发送的增量更新（包含时间戳）。
    - `GET /api/sync/list`: 获取后端存储的会话摘要列表。

## 阶段 2：前端同步引擎开发 (`hooks/` & `utils/`)
- [ ] **数据模型增强**:
    - 升级 `utils/db.ts` 中的 Schema，为所有存储对象（Session, Setting, Scenario）增加 `updatedAt` 时间戳字段。
- [ ] **开发 `useSyncManager` Hook**:
    - **拉取策略**: 应用启动时，对比本地与后端时间戳，自动执行 `Initial Pull`。
    - **推送策略**: 监听 IndexedDB 变更（或在持久化操作后），触发异步 `Background Push`。
- [ ] **合并算法**:
    - 实现基础的 “最后写入获胜 (LWW)” 冲突解决逻辑。

## 阶段 3：实时通信与广播 (WebSocket)
- [ ] **后端广播机制**:
    - 当 `local-server.cjs` 接收到某一设备的 `push` 请求后，通过 WebSocket 向所有其他连接客户端发送 `DATA_UPDATED` 信号。
- [ ] **前端实时刷新**:
    - 客户端监听到 `DATA_UPDATED` 信号后，自动从后端拉取最新变更并静默更新本地 IndexedDB，实现“无感同步”。

## 阶段 4：高级优化与易用性
- [ ] **局域网发现 (mDNS)**:
    - 引入 `multicast-dns`，让手机端等 Spokes 能够通过 `gemini-chat.local` 自动发现并连接 Hub，无需手动输入 IP。
- [ ] **设备识别与过滤**:
    - 为每个客户端生成唯一 `DeviceID`，防止同步信号在发送设备上触发循环更新。
- [ ] **增量同步优化**:
    - 针对大型聊天记录，仅同步文本变更，附件（图片/视频）继续引用 Google Cloud URI 或按需按需同步。
