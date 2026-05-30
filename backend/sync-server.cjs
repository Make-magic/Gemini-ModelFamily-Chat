const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

const isPkg = typeof process.pkg !== 'undefined';
// 如果是 pkg 打包环境，baseDir 为可执行文件所在目录；否则为项目根目录 (backend 的上一级)
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

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
        if (parsedMessage.type === 'REGISTER_SYNC_CLIENT') {
          this.logger.info('已注册同步客户端');
          this.syncClients.add(websocket);
        }
      } catch (error) {
        this.logger.error('解析WebSocket消息失败');
      }
    });
    websocket.on('close', () => {
      this.syncClients.delete(websocket);
      this.logger.info('客户端连接断开');
    });
    websocket.on('error', (error) => {
      this.logger.error(`WebSocket连接错误: ${error.message}`);
    });
  }
  broadcast(message) {
    const messageString = JSON.stringify(message);
    this.syncClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageString);
      }
    });
  }
}

class SyncService {
  constructor(logger, connectionRegistry) {
    this.logger = logger;
    this.connectionRegistry = connectionRegistry;
    this.storagePath = path.join(baseDir, 'storage');
    this.sessionsPath = path.join(this.storagePath, 'sessions');
  }

  async init() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await fs.mkdir(this.sessionsPath, { recursive: true });
      this.logger.info(`同步存储目录已就绪: ${this.storagePath}`);
    } catch (error) {
      this.logger.error(`初始化同步目录失败: ${error.message}`);
    }
  }

  async getMetadata() {
    const metadata = {
      sessions: {},
      groups: { updatedAt: 0 },
      settings: { updatedAt: 0 },
      scenarios: { updatedAt: 0 }
    };
    try {
      try {
        const files = await fs.readdir(this.sessionsPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(this.sessionsPath, file), 'utf-8');
            const session = JSON.parse(content);
            metadata.sessions[session.id] = session.updatedAt || session.timestamp || 0;
          }
        }
      } catch (e) {}

      const otherFiles = ['groups', 'settings', 'scenarios'];
      for (const type of otherFiles) {
        const filePath = path.join(this.storagePath, `${type}.json`);
        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          
          let internalMax = 0;
          if (Array.isArray(data)) {
             internalMax = Math.max(...data.map(item => item.updatedAt || item.timestamp || 0), 0);
          } else {
             internalMax = data.updatedAt || 0;
          }
          metadata[type].updatedAt = Math.max(internalMax, stats.mtimeMs);
        } catch (e) {}
      }
    } catch (error) {
      this.logger.error(`获取同步元数据失败: ${error.message}`);
    }
    return metadata;
  }

  async saveItem(type, data) {
    try {
      let filePath;
      if (type === 'session') {
        filePath = path.join(this.sessionsPath, `${data.id}.json`);
      } else {
        filePath = path.join(this.storagePath, `${type}.json`);
      }
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.connectionRegistry.broadcast({
        type: 'SYNC_EVENT',
        dataType: type,
        itemId: data.id,
        updatedAt: data.updatedAt
      });
      return true;
    } catch (error) {
      this.logger.error(`保存同步项失败 (${type}): ${error.message}`);
      return false;
    }
  }

  async deleteItem(type, id) {
    try {
      if (type === 'session') {
        const filePath = path.join(this.sessionsPath, `${id}.json`);
        await fs.unlink(filePath);
        this.connectionRegistry.broadcast({
          type: 'SYNC_DELETE_EVENT',
          dataType: type,
          itemId: id
        });
      }
      return true;
    } catch (error) {
      this.logger.error(`删除同步项失败 (${type}): ${error.message}`);
      return false;
    }
  }

  async getItem(type, id) {
    try {
      let filePath;
      if (type === 'session') {
        filePath = path.join(this.sessionsPath, `${id}.json`);
      } else {
        filePath = path.join(this.storagePath, `${type}.json`);
      }
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async getAll(type) {
    if (type === 'sessions') {
      const sessions = [];
      try {
        const files = await fs.readdir(this.sessionsPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(this.sessionsPath, file), 'utf-8');
            sessions.push(JSON.parse(content));
          }
        }
      } catch (e) {}
      return sessions;
    } else {
      return this.getItem(type);
    }
  }
}

// 可导出 Router 函数，让不同环境都可以挂载同步路由
function createSyncRouter(syncService) {
  const router = express.Router();

  router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    const requestHeaders = req.headers['access-control-request-headers'];
    if (requestHeaders) {
      res.header('Access-Control-Allow-Headers', requestHeaders);
    } else {
      res.header('Access-Control-Allow-Headers', '*');
    }
    next();
  });

  router.options(/(.*)/, (req, res) => {
    res.status(200).end();
  });

  router.get('/metadata', async (req, res) => {
    const metadata = await syncService.getMetadata();
    res.json(metadata);
  });

  router.get('/pull', async (req, res) => {
    const { type, id } = req.query;
    const data = await syncService.getItem(type, id);
    res.json(data);
  });

  router.get('/pull-all', async (req, res) => {
    const [sessions, groups, settings, scenarios] = await Promise.all([
      syncService.getAll('sessions'),
      syncService.getItem('groups'),
      syncService.getItem('settings'),
      syncService.getItem('scenarios')
    ]);
    res.json({ sessions, groups, settings, scenarios });
  });

  router.post('/push', express.json({ limit: '200mb' }), async (req, res) => {
    const { type, data } = req.body;
    const success = await syncService.saveItem(type, data);
    res.json({ success });
  });

  router.delete('/delete', async (req, res) => {
    const { type, id } = req.query;
    const success = await syncService.deleteItem(type, id);
    res.json({ success });
  });

  return router;
}

class SyncServerSystem {
  constructor(config = {}) {
    this.config = {
      httpPort: 8889,
      wsPort: 9998,
      host: '0.0.0.0',
      ...config
    };
    this.logger = new LoggingService('SyncServer');
    this.connectionRegistry = new ConnectionRegistry(this.logger);
    this.syncService = new SyncService(this.logger, this.connectionRegistry);
  }

  async start() {
    await this.syncService.init();
    
    // Start HTTP API
    const app = express();
    app.use('/api/sync', createSyncRouter(this.syncService));
    
    this.httpServer = http.createServer(app);
    await new Promise((resolve) => {
      this.httpServer.listen(this.config.httpPort, this.config.host, () => {
        this.logger.info(`Sync HTTP 服务启动: http://${this.config.host}:${this.config.httpPort}`);
        resolve();
      });
    });

    // Start WebSocket
    this.wsServer = new WebSocket.Server({
      port: this.config.wsPort,
      host: this.config.host
    });

    this.wsServer.on('connection', (ws, req) => {
      this.connectionRegistry.addConnection(ws, {
        address: req.socket.remoteAddress
      });
    });

    this.logger.info(`Sync WebSocket 服务启动: ws://${this.config.host}:${this.config.wsPort}`);
  }
}

// Allow starting directly or exporting
if (require.main === module) {
  const server = new SyncServerSystem();
  server.start().catch(err => {
    console.error('Failed to start sync server', err);
    process.exit(1);
  });
}

module.exports = { SyncServerSystem, createSyncRouter, SyncService, ConnectionRegistry, LoggingService };
