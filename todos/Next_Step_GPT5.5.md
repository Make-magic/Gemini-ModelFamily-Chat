# Next Step 项目改进清单

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
