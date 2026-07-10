const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fsNative = require('fs');
const fs = fsNative.promises;
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { EventEmitter } = require('events');

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

const SYNC_ITEM_TYPES = Object.freeze(['session', 'groups', 'settings', 'scenarios']);
const SYNC_ITEM_TYPE_SET = new Set(SYNC_ITEM_TYPES);
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const BLOB_ID_PATTERN = /^[A-Fa-f0-9]{64}$/;
const DEFAULT_JSON_LIMIT = '600mb';

class SyncValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'SyncValidationError';
    this.statusCode = statusCode;
  }
}

class SyncConflictError extends Error {
  constructor(currentRevision) {
    super('The remote item changed after metadata was read. Pull and retry.');
    this.name = 'SyncConflictError';
    this.statusCode = 409;
    this.currentRevision = currentRevision;
  }
}

class LoggingService {
  constructor(serviceName = 'SyncServer') {
    this.serviceName = serviceName;
  }
  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${level}] ${timestamp} [${this.serviceName}] - ${message}`;
  }
  info(message) { console.log(this._formatMessage('INFO', message)); }
  error(message) { console.error(this._formatMessage('ERROR', message)); }
  warn(message) { console.warn(this._formatMessage('WARN', message)); }
  debug(message) { console.debug(this._formatMessage('DEBUG', message)); }
}

class ConnectionRegistry extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.syncClients = new Set();
  }

  addConnection(websocket, clientInfo) {
    this.logger.info(`新 WebSocket 连接: ${clientInfo.address}`);
    websocket.on('message', (data) => {
      try {
        const parsedMessage = JSON.parse(data.toString());
        if (parsedMessage.type !== 'REGISTER_SYNC_CLIENT') return;
        this.logger.info('已注册同步客户端');
        this.syncClients.add(websocket);
      } catch (error) {
        this.logger.error(`解析 WebSocket 消息失败: ${error.message}`);
        websocket.close(1003, 'Invalid message');
      }
    });
    websocket.on('close', () => {
      this.syncClients.delete(websocket);
      this.logger.info('客户端连接断开');
    });
    websocket.on('error', (error) => {
      this.logger.error(`WebSocket 连接错误: ${error.message}`);
    });
  }

  broadcast(message) {
    const messageString = JSON.stringify(message);
    this.syncClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(messageString);
    });
  }
}

class SyncService {
  constructor(logger, connectionRegistry, options = {}) {
    this.logger = logger;
    this.connectionRegistry = connectionRegistry;
    this.storagePath = path.resolve(options.storagePath || path.join(baseDir, 'storage'));
    this.sessionsPath = path.resolve(this.storagePath, 'sessions');
    this.blobsPath = path.resolve(this.storagePath, 'blobs');
    this.writeQueues = new Map();
  }

  async init() {
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.mkdir(this.sessionsPath, { recursive: true });
    await fs.mkdir(this.blobsPath, { recursive: true });
    this.logger.info(`同步存储目录已就绪: ${this.storagePath}`);
  }

  validateType(type) {
    if (typeof type !== 'string' || !SYNC_ITEM_TYPE_SET.has(type)) {
      throw new SyncValidationError(`Unsupported sync type. Allowed values: ${SYNC_ITEM_TYPES.join(', ')}`);
    }
    return type;
  }

  validateSessionId(id) {
    if (typeof id !== 'string' || !SESSION_ID_PATTERN.test(id) || id === '.' || id === '..') {
      throw new SyncValidationError('Invalid session id.');
    }
    return id;
  }

  validateBlobId(blobId) {
    if (typeof blobId !== 'string' || !BLOB_ID_PATTERN.test(blobId)) {
      throw new SyncValidationError('Invalid blob id.');
    }
    return blobId.toLowerCase();
  }

  assertPathWithin(rootPath, candidatePath) {
    const relative = path.relative(rootPath, candidatePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SyncValidationError('Resolved path is outside the sync storage directory.');
    }
  }

  resolveItemPath(type, id) {
    this.validateType(type);
    const rootPath = type === 'session' ? this.sessionsPath : this.storagePath;
    const filename = type === 'session'
      ? `${this.validateSessionId(id)}.json`
      : `${type}.json`;
    const resolvedPath = path.resolve(rootPath, filename);
    this.assertPathWithin(rootPath, resolvedPath);
    return resolvedPath;
  }

  resolveBlobPath(blobId) {
    const filename = `${this.validateBlobId(blobId)}.blob`;
    const resolvedPath = path.resolve(this.blobsPath, filename);
    this.assertPathWithin(this.blobsPath, resolvedPath);
    return resolvedPath;
  }

  validateData(type, data) {
    if (type === 'session') {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new SyncValidationError('Session data must be an object.');
      }
      this.validateSessionId(data.id);
      return;
    }

    if ((type === 'groups' || type === 'scenarios') && !Array.isArray(data)) {
      throw new SyncValidationError(`${type} data must be an array.`);
    }
    if (type === 'settings' && (!data || typeof data !== 'object' || Array.isArray(data))) {
      throw new SyncValidationError('settings data must be an object.');
    }
  }

  async assertNotSymlink(filePath) {
    try {
      const stats = await fs.lstat(filePath);
      if (stats.isSymbolicLink()) throw new SyncValidationError('Symbolic links are not allowed in sync storage.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async readItemFile(filePath) {
    await this.assertNotSymlink(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    return {
      content,
      data: JSON.parse(content),
      revision: this.hashContent(content),
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    };
  }

  async getRevisionForPath(filePath) {
    try {
      const item = await this.readItemFile(filePath);
      return item.revision;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async withWriteLock(filePath, operation) {
    const previous = this.writeQueues.get(filePath) || Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.writeQueues.set(filePath, current);
    try {
      return await current;
    } finally {
      if (this.writeQueues.get(filePath) === current) this.writeQueues.delete(filePath);
    }
  }

  async atomicWriteJson(filePath, data) {
    const serialized = JSON.stringify(data, null, 2);
    const tempPath = path.resolve(
      path.dirname(filePath),
      `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
    );
    this.assertPathWithin(path.dirname(filePath), tempPath);

    let handle;
    try {
      handle = await fs.open(tempPath, 'wx');
      await handle.writeFile(serialized, 'utf-8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(tempPath, filePath);
      return this.hashContent(serialized);
    } finally {
      if (handle) await handle.close().catch(() => undefined);
      await fs.unlink(tempPath).catch(error => {
        if (error.code !== 'ENOENT') this.logger.warn(`清理临时文件失败: ${error.message}`);
      });
    }
  }

  async saveBlob(readable) {
    const tempPath = path.resolve(
      this.blobsPath,
      `.upload.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
    );
    this.assertPathWithin(this.blobsPath, tempPath);

    const hash = crypto.createHash('sha256');
    let size = 0;
    const hashStream = new Transform({
      transform(chunk, encoding, callback) {
        size += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        readable,
        hashStream,
        fsNative.createWriteStream(tempPath, { flags: 'wx' })
      );

      const blobId = hash.digest('hex');
      const blobPath = this.resolveBlobPath(blobId);

      await this.withWriteLock(blobPath, async () => {
        await this.assertNotSymlink(blobPath);
        try {
          const existingStats = await fs.stat(blobPath);
          if (!existingStats.isFile() || existingStats.size !== size) {
            throw new Error(`Existing blob does not match its content id: ${blobId}`);
          }
          return;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }

        await fs.rename(tempPath, blobPath);
      });

      return { blobId, size };
    } finally {
      await fs.unlink(tempPath).catch(error => {
        if (error.code !== 'ENOENT') this.logger.warn(`清理 Blob 临时文件失败: ${error.message}`);
      });
    }
  }

  async getBlobInfo(blobId) {
    const normalizedBlobId = this.validateBlobId(blobId);
    const blobPath = this.resolveBlobPath(normalizedBlobId);
    try {
      await this.assertNotSymlink(blobPath);
      const stats = await fs.stat(blobPath);
      if (!stats.isFile()) throw new SyncValidationError('Blob path is not a file.');
      return { blobId: normalizedBlobId, blobPath, size: stats.size };
    } catch (error) {
      if (error.code === 'ENOENT') throw new SyncValidationError('Blob not found.', 404);
      throw error;
    }
  }

  async getMetadata() {
    const metadata = {
      sessions: {},
      groups: { updatedAt: 0 },
      settings: { updatedAt: 0 },
      scenarios: { updatedAt: 0 },
      revisions: { sessions: {}, groups: null, settings: null, scenarios: null },
      sizes: { sessions: {}, groups: 0, settings: 0, scenarios: 0 },
    };

    try {
      const files = await fs.readdir(this.sessionsPath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const candidatePath = path.resolve(this.sessionsPath, file);
        this.assertPathWithin(this.sessionsPath, candidatePath);
        try {
          const item = await this.readItemFile(candidatePath);
          const sessionId = this.validateSessionId(item.data.id);
          metadata.sessions[sessionId] = item.data.updatedAt || item.data.timestamp || 0;
          metadata.revisions.sessions[sessionId] = item.revision;
          metadata.sizes.sessions[sessionId] = item.size;
        } catch (error) {
          this.logger.warn(`跳过无效会话文件 ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.logger.error(`读取会话元数据失败: ${error.message}`);
    }

    for (const type of ['groups', 'settings', 'scenarios']) {
      const filePath = this.resolveItemPath(type);
      try {
        const item = await this.readItemFile(filePath);
        const internalMax = Array.isArray(item.data)
          ? Math.max(...item.data.map(entry => entry.updatedAt || entry.timestamp || 0), 0)
          : item.data.updatedAt || 0;
        metadata[type].updatedAt = Math.max(internalMax, item.mtimeMs);
        metadata.revisions[type] = item.revision;
        metadata.sizes[type] = item.size;
      } catch (error) {
        if (error.code !== 'ENOENT') this.logger.warn(`读取 ${type} 元数据失败: ${error.message}`);
      }
    }

    return metadata;
  }

  async saveItem(type, data, expectedRevision) {
    this.validateType(type);
    this.validateData(type, data);
    const id = type === 'session' ? data.id : undefined;
    const filePath = this.resolveItemPath(type, id);

    return this.withWriteLock(filePath, async () => {
      const currentRevision = await this.getRevisionForPath(filePath);
      if (expectedRevision !== currentRevision) throw new SyncConflictError(currentRevision);

      const revision = await this.atomicWriteJson(filePath, data);
      this.connectionRegistry.broadcast({
        type: 'SYNC_EVENT',
        dataType: type,
        itemId: id,
        updatedAt: data.updatedAt,
        revision,
      });
      return { success: true, revision };
    });
  }

  async deleteItem(type, id, expectedRevision) {
    this.validateType(type);
    if (type !== 'session') throw new SyncValidationError('Only session deletion is supported.');
    const filePath = this.resolveItemPath(type, id);

    return this.withWriteLock(filePath, async () => {
      const currentRevision = await this.getRevisionForPath(filePath);
      if (currentRevision === null) return { success: true, revision: null };
      if (expectedRevision !== currentRevision) throw new SyncConflictError(currentRevision);

      await fs.unlink(filePath);
      this.connectionRegistry.broadcast({
        type: 'SYNC_DELETE_EVENT',
        dataType: type,
        itemId: id,
      });
      return { success: true, revision: null };
    });
  }

  async getItem(type, id) {
    const filePath = this.resolveItemPath(type, id);
    try {
      return (await this.readItemFile(filePath)).data;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async getAll(type) {
    if (type !== 'sessions') throw new SyncValidationError('Unsupported sync collection.');
    const sessions = [];
    const files = await fs.readdir(this.sessionsPath).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const candidatePath = path.resolve(this.sessionsPath, file);
      this.assertPathWithin(this.sessionsPath, candidatePath);
      try {
        sessions.push((await this.readItemFile(candidatePath)).data);
      } catch (error) {
        this.logger.warn(`跳过无效会话文件 ${file}: ${error.message}`);
      }
    }
    return sessions;
  }
}

const requireBaseRevision = (value) => {
  if (value === undefined) throw new SyncValidationError('baseRevision is required.', 428);
  if (value !== null && typeof value !== 'string') {
    throw new SyncValidationError('baseRevision must be a SHA-256 string or null.');
  }
  return value;
};

function createSyncRouter(syncService, options = {}) {
  const router = express.Router();
  const jsonLimit = options.jsonLimit || process.env.SYNC_JSON_LIMIT || DEFAULT_JSON_LIMIT;

  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    res.header('Access-Control-Max-Age', '600');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  router.post('/blob', async (req, res) => {
    const result = await syncService.saveBlob(req);
    res.status(201).json(result);
  });

  router.get('/blob/:blobId', async (req, res) => {
    const blob = await syncService.getBlobInfo(req.params.blobId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(blob.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `\"${blob.blobId}\"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(fsNative.createReadStream(blob.blobPath), res);
  });

  router.use(express.json({ limit: jsonLimit }));

  router.get('/metadata', async (req, res) => {
    res.json(await syncService.getMetadata());
  });

  router.get('/pull', async (req, res) => {
    const { type, id } = req.query;
    res.json(await syncService.getItem(type, id));
  });

  router.get('/pull-all', async (req, res) => {
    const [sessions, groups, settings, scenarios] = await Promise.all([
      syncService.getAll('sessions'),
      syncService.getItem('groups'),
      syncService.getItem('settings'),
      syncService.getItem('scenarios'),
    ]);
    res.json({ sessions, groups, settings, scenarios });
  });

  router.post('/push', async (req, res) => {
    const { type, data, baseRevision } = req.body || {};
    const result = await syncService.saveItem(type, data, requireBaseRevision(baseRevision));
    res.json(result);
  });

  router.delete('/delete', async (req, res) => {
    const { type, id } = req.query;
    const rawBaseRevision = req.headers['if-match'] ?? req.query.baseRevision;
    const baseRevision = rawBaseRevision === 'null' ? null : rawBaseRevision;
    const result = await syncService.deleteItem(type, id, requireBaseRevision(baseRevision));
    res.json(result);
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const statusCode = error.statusCode || (error.type === 'entity.too.large' ? 413 : 500);
    if (statusCode >= 500) syncService.logger.error(`同步请求失败: ${error.message}`);
    res.status(statusCode).json({
      error: statusCode >= 500 ? 'Internal sync server error.' : error.message,
      ...(error.currentRevision !== undefined ? { currentRevision: error.currentRevision } : {}),
    });
  });

  return router;
}

class SyncServerSystem {
  constructor(config = {}) {
    this.config = {
      httpPort: Number(process.env.SYNC_HTTP_PORT || 8889),
      wsPort: Number(process.env.SYNC_WS_PORT || 9998),
      host: process.env.SYNC_HOST || '0.0.0.0',
      jsonLimit: process.env.SYNC_JSON_LIMIT || DEFAULT_JSON_LIMIT,
      ...config,
    };
    this.logger = new LoggingService('SyncServer');
    this.connectionRegistry = new ConnectionRegistry(this.logger);
    this.syncService = new SyncService(this.logger, this.connectionRegistry, {
      storagePath: this.config.storagePath,
    });
  }

  async start() {
    await this.syncService.init();

    const app = express();
    app.use('/api/sync', createSyncRouter(this.syncService, {
      jsonLimit: this.config.jsonLimit,
    }));

    this.httpServer = http.createServer(app);
    await new Promise((resolve) => {
      this.httpServer.listen(this.config.httpPort, this.config.host, () => {
        this.logger.info(`Sync HTTP 服务启动: http://${this.config.host}:${this.config.httpPort}`);
        resolve();
      });
    });

    this.wsServer = new WebSocket.Server({
      port: this.config.wsPort,
      host: this.config.host,
    });

    this.wsServer.on('connection', (ws, req) => {
      this.connectionRegistry.addConnection(ws, { address: req.socket.remoteAddress });
    });

    this.logger.info(`Sync WebSocket 服务启动: ws://${this.config.host}:${this.config.wsPort}`);
  }
}

if (require.main === module) {
  const server = new SyncServerSystem();
  server.start().catch(error => {
    console.error('Failed to start sync server', error);
    process.exit(1);
  });
}

module.exports = {
  SyncServerSystem,
  createSyncRouter,
  SyncService,
  ConnectionRegistry,
  LoggingService,
  SyncValidationError,
  SyncConflictError,
};
