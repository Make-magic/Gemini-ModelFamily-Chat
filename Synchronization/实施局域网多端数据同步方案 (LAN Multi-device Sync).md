# 局域网多端同步方案 (LAN Multi-device Sync) - 实施规范

## 1. 核心目标
通过“中枢-分支 (Hub-and-Spoke)”架构，将 `local-server.cjs` 升级为局域网数据中心（Data Hub），实现多个浏览器客户端（PC、手机等）在设置 (Settings)、聊天历史 (Sessions)、分组 (Groups) 及场景预设 (Scenarios) 上的实时同步与一致性。

---

## 2. 后端数据中枢实现 (`backend/local-server.cjs`)

### **2.1 存储结构设计**
在项目根目录创建 `storage/` 文件夹（已加入 .gitignore）：
- `storage/settings.json`: 存储全局应用配置。
- `storage/groups.json`: 存储聊天分组信息。
- `storage/scenarios.json`: 存储用户自定义场景。
- `storage/sessions/`: 文件夹，按 `{sessionId}.json` 独立存储会话，解决单一巨型文件带来的 I/O 性能问题。

### **2.2 同步服务模块 (SyncService)**
- **原子化写入**: 使用 `fs/promises` 确保数据写入的原子性。
- **元数据管理**: `/api/sync/metadata` 路由提供所有同步项的版本（`updatedAt`）摘要，用于前端执行快速增量对比。
- **增量同步 API**:
    - `GET /api/sync/pull`: 根据类型和 ID 拉取特定数据。
    - `POST /api/sync/push`: 接收前端增量更新，保存至磁盘。
    - `DELETE /api/sync/delete`: 处理会话删除的物理同步。

### **2.3 实时广播机制**
- **连接分类**: `ConnectionRegistry` 将 WebSocket 连接分为 `proxyClients`（用于 HTTP 回弹代理）和 `syncClients`（用于同步通知）。
- **客户端注册**: 前端通过发送 `{type: 'REGISTER_SYNC_CLIENT'}` 声明身份。
- **变更推送**: 任何设备执行 `push` 后，服务器立即向所有 `syncClients` 广播 `SYNC_EVENT` 或 `SYNC_DELETE_EVENT` 信号。

---

## 3. 前端同步引擎实现 (`hooks/core/useSyncManager.ts`)

### **3.1 数据模型增强**
为所有持久化对象增加了 `updatedAt` (number) 字段，这是实现“最后写入获胜 (LWW)”策略的核心：
- `AppSettings`
- `SavedChatSession`
- `ChatGroup`
- `SavedScenario`

### **3.2 同步策略流程**
1.  **手动触发 (Manual Control)**: 
    - 同步完全由用户掌控，分为“从服务器拉取”和“向服务器推送”两个独立操作。
2.  **拉取逻辑 (Pull from Hub)**: 
    - 请求服务器 `/metadata`。
    - 对比时间戳，仅下载服务器上版本更晚的数据并合并到本地 IndexedDB。
3.  **推送逻辑 (Push to Hub)**: 
    - 请求服务器 `/metadata`。
    - 对比时间戳，仅将本地版本更晚的数据上传至服务器磁盘。
4.  **UI 反馈**:
    - 顶部 Header 提供两个独立图标按钮：`DownloadCloud` (拉取) 和 `UploadCloud` (推送)。
    - 每个按钮均有独立的旋转动画、成功勾选和错误提示。
    - 鼠标悬停可分别查看上次拉取和推送成功的时间。

---

## 4. UI 整合
- 在 `Header` 组件右侧操作区新增两个同步按钮。
- 只有在本地数据加载完毕且设置就绪后，同步按钮才变为可用状态。
- 同步过程中，按钮将进入禁用状态以防止并发冲突。

---

## 4. 冲突解决逻辑
采用 **最后写入获胜 (LWW - Last Write Wins)** 策略：
- 每个操作都会生成新的 `Date.now()` 时间戳。
- 同步过程中，始终以 `updatedAt` 更大的数据为准。
- 针对删除操作，服务器发送 `SYNC_DELETE_EVENT` 信号，客户端执行物理删除以保持状态同步。

---

## 5. 当前状态：[已完成]
- [x] 核心数据 Schema 升级
- [x] 后端 `SyncService` 与磁盘存储逻辑
- [x] Express 同步路由整合
- [x] WebSocket 广播与客户端分类逻辑
- [x] 前端 `useSyncManager` 核心 Hook
- [x] 设置、会话、分组、场景全链路同步支持
- [x] 自动重连与优雅降级机制
