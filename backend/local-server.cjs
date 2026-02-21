// local-server.js
// version 2.3.1
// 本地服务器，用于通过WebSocket代理HTTP请求到浏览器环境，并返回结果
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const fetch = require('node-fetch');
const { createProxyMiddleware } = require('http-proxy-middleware');

const isPkg = typeof process.pkg !== 'undefined';
// 如果是 pkg 打包环境，baseDir 为可执行文件所在目录；否则为项目根目录 (backend 的上一级)
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
console.log("!!! LOCAL SERVER (backend/local-server.cjs) is Running !!!");
console.log(`!!! Environment: ${isPkg ? 'Pkg (Executable)' : 'Node.js (Development)'} !!!`);
console.log(`!!! Base Directory: ${baseDir} !!!`);
console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

// 日志记录器模块
class LoggingService {
  constructor(serviceName = 'ProxyServer') {
    this.serviceName = serviceName;
  }

  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${level}] ${timestamp} [${this.serviceName}] - ${message}`;
  }

  info(message) {
    console.log(this._formatMessage('INFO', message));
  }

  error(message) {
    console.error(this._formatMessage('ERROR', message));
  }

  warn(message) {
    console.warn(this._formatMessage('WARN', message));
  }

  debug(message) {
    console.debug(this._formatMessage('DEBUG', message));
  }
}

// 同步服务模块
class SyncService {
  constructor(logger, connectionRegistry) {
    this.logger = logger;
    this.connectionRegistry = connectionRegistry;
    // 数据存储始终在物理磁盘（EXE同级或项目根目录）
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
      // Sessions
      try {
        const files = await fs.readdir(this.sessionsPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(this.sessionsPath, file), 'utf-8');
            const session = JSON.parse(content);
            metadata.sessions[session.id] = session.updatedAt || session.timestamp || 0;
          }
        }
      } catch (e) {
        // sessions dir might not exist yet
      }

      // Other files
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
        } catch (e) {
          // File might not exist yet
        }
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

// 消息队列实现
class MessageQueue extends EventEmitter {
  constructor(timeoutMs = 600000) {
    super();
    this.messages = [];
    this.waitingResolvers = [];
    this.defaultTimeout = timeoutMs;
    this.closed = false;
  }

  enqueue(message) {
    if (this.closed) return;

    if (this.waitingResolvers.length > 0) {
      const resolver = this.waitingResolvers.shift();
      resolver.resolve(message);
    } else {
      this.messages.push(message);
    }
  }

  async dequeue(timeoutMs = this.defaultTimeout) {
    if (this.closed) {
      throw new Error('Queue is closed');
    }

    return new Promise((resolve, reject) => {
      if (this.messages.length > 0) {
        resolve(this.messages.shift());
        return;
      }

      const resolver = { resolve, reject };
      this.waitingResolvers.push(resolver);

      const timeoutId = setTimeout(() => {
        const index = this.waitingResolvers.indexOf(resolver);
        if (index !== -1) {
          this.waitingResolvers.splice(index, 1);
          reject(new Error('Queue timeout'));
        }
      }, timeoutMs);

      resolver.timeoutId = timeoutId;
    });
  }

  close() {
    this.closed = true;
    this.waitingResolvers.forEach(resolver => {
      clearTimeout(resolver.timeoutId);
      resolver.reject(new Error('Queue closed'));
    });
    this.waitingResolvers = [];
    this.messages = [];
  }
}

// WebSocket连接管理器
class ConnectionRegistry extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.proxyClients = new Set();
    this.syncClients = new Set();
    this.messageQueues = new Map();
  }

  addConnection(websocket, clientInfo) {
    this.logger.info(`新连接尝试: ${clientInfo.address}`);

    websocket.on('message', (data) => {
      this._handleIncomingMessage(websocket, data.toString());
    });

    websocket.on('close', () => {
      this._removeConnection(websocket);
    });

    websocket.on('error', (error) => {
      this.logger.error(`WebSocket连接错误: ${error.message}`);
    });

    this.proxyClients.add(websocket);
    this.emit('connectionAdded', websocket);
  }

  _removeConnection(websocket) {
    this.proxyClients.delete(websocket);
    this.syncClients.delete(websocket);
    this.logger.info('客户端连接断开');

    if (this.proxyClients.size === 0) {
        this.messageQueues.forEach(queue => queue.close());
        this.messageQueues.clear();
    }

    this.emit('connectionRemoved', websocket);
  }

  _handleIncomingMessage(websocket, messageData) {
    try {
      const parsedMessage = JSON.parse(messageData);

      if (parsedMessage.type === 'REGISTER_SYNC_CLIENT') {
        this.logger.info('已注册同步客户端');
        this.proxyClients.delete(websocket);
        this.syncClients.add(websocket);
        return;
      }

      const requestId = parsedMessage.request_id;

      if (!requestId) {
        return;
      }

      const queue = this.messageQueues.get(requestId);
      if (queue) {
        this._routeMessage(parsedMessage, queue);
      }
    } catch (error) {
      this.logger.error('解析WebSocket消息失败');
    }
  }

  _routeMessage(message, queue) {
    const { event_type } = message;

    switch (event_type) {
      case 'response_headers':
      case 'chunk':
      case 'error':
        queue.enqueue(message);
        break;
      case 'stream_close':
        queue.enqueue({ type: 'STREAM_END' });
        break;
      default:
        this.logger.warn(`未知的事件类型: ${event_type}`);
    }
  }

  hasActiveConnections() {
    return this.proxyClients.size > 0;
  }

  getFirstConnection() {
    return this.proxyClients.values().next().value;
  }

  createMessageQueue(requestId) {
    const queue = new MessageQueue();
    this.messageQueues.set(requestId, queue);
    return queue;
  }

  removeMessageQueue(requestId) {
    const queue = this.messageQueues.get(requestId);
    if (queue) {
      queue.close();
      this.messageQueues.delete(requestId);
    }
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

// 请求处理器
class RequestHandler {
  constructor(connectionRegistry, logger, config) {
    this.connectionRegistry = connectionRegistry;
    this.logger = logger;
    if (!config) {throw new Error('RequestHandler requires a configuration object.');}
    this.config = config;
  }

  async processRequest(req, res) {
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    this.logger.info(`处理请求: ${req.method} ${req.url} (Original: ${req.originalUrl}) Type: ${req.get('content-type')}`);

    if (!this.connectionRegistry.hasActiveConnections()) {
      return this._sendErrorResponse(res, 503, '没有可用的浏览器连接');
    }

    const bodyChunks = [];
    req.on('data', chunk => {
      bodyChunks.push(chunk);
    });

    req.on('end', async () => {
      const body = Buffer.concat(bodyChunks);
      const body_b64 = body.toString('base64');
      const requestId = this._generateRequestId();

      const requestData = {
        path: req.path,
        url: req.originalUrl || req.url,
        method: req.method,
        headers: req.headers,
        query_params: req.query,
        body_b64: body_b64,
        request_id: requestId
      };

      const messageQueue = this.connectionRegistry.createMessageQueue(requestId);

      try {
        await this._forwardRequest(requestData);
        await this._handleResponse(messageQueue, res);
      } catch (error) {
        this._handleRequestError(error, res);
      } finally {
        this.connectionRegistry.removeMessageQueue(requestId);
      }
    });
  }

  _generateRequestId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  async _forwardRequest(proxyRequest) {
    const connection = this.connectionRegistry.getFirstConnection();
    connection.send(JSON.stringify(proxyRequest));
  }

  async _handleResponse(messageQueue, res) {
    const headerMessage = await messageQueue.dequeue();

    if (headerMessage.event_type === 'error') {
      return this._sendErrorResponse(res, headerMessage.status || 500, headerMessage.message);
    }

    this._setResponseHeaders(res, headerMessage);
    await this._streamResponseData(messageQueue, res);
  }

  _setResponseHeaders(res, headerMessage) {
    res.status(headerMessage.status || 200);
    const headers = headerMessage.headers || {};
    const forbiddenHeaders = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'];

    Object.entries(headers).forEach(([name, value]) => {
      if (!forbiddenHeaders.includes(name.toLowerCase())) {
        if (name.toLowerCase() === 'x-goog-upload-url') {
          try {
            const originalUrl = new URL(value);
            const newUrl = `http://${this.config.host}:${this.config.httpPort}${originalUrl.pathname}${originalUrl.search}`;
            res.set(name, newUrl);
          } catch (e) {
            res.set(name, value);
          }
        } else {
          res.set(name, value);
        }
      }
    });
  }

  async _streamResponseData(messageQueue, res) {
    while (true) {
      try {
        const dataMessage = await messageQueue.dequeue(30000);

        if (dataMessage.type === 'STREAM_END') {
          break;
        }

        if (dataMessage.data) {
          res.write(dataMessage.data);
        }
      } catch (error) {
        if (error.message === 'Queue timeout') {
          const contentType = res.get('Content-Type') || '';
          if (contentType.includes('text/event-stream')) {
            res.write(': keepalive\n\n');
          } else {
            break;
          }
        } else {
          throw error;
        }
      }
    }
    res.end();
  }

  _handleRequestError(error, res) {
    if (res.headersSent) {
      res.end();
      return;
    }

    if (error.message === 'Queue timeout') {
      this._sendErrorResponse(res, 504, '请求超时');
    } else {
      this.logger.error(`请求处理错误: ${error.message}`);
      this._sendErrorResponse(res, 500, `代理错误: ${error.message}`);
    }
  }

  _sendErrorResponse(res, status, message) {
    res.status(status).send(message);
  }
}

// 主服务器类
class ProxyServerSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      httpPort: 8889,
      wsPort: 9998,
      host: '0.0.0.0',
      ...config
    };

    this.logger = new LoggingService('ProxyServer');
    this.connectionRegistry = new ConnectionRegistry(this.logger);
    this.syncService = new SyncService(this.logger, this.connectionRegistry);
    this.requestHandler = new RequestHandler(this.connectionRegistry, this.logger, this.config);

    this.httpServer = null;
    this.wsServer = null;
  }

  async start() {
    try {
      await this.syncService.init();
      await this._startHttpServer();
      await this._startWebSocketServer();

      this.logger.info('代理服务器系统启动完成');
      this.emit('started');
    } catch (error) {
      this.logger.error(`启动失败: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  async _startHttpServer() {
    const app = this._createExpressApp();
    this.httpServer = http.createServer(app);

    return new Promise((resolve) => {
      this.httpServer.listen(this.config.httpPort, this.config.host, () => {
        this.logger.info(`HTTP服务器启动: http://${this.config.host}:${this.config.httpPort}`);
        resolve();
      });
    });
  }

  _createExpressApp() {
    const app = express();

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      const requestHeaders = req.headers['access-control-request-headers'];
      if (requestHeaders) {
        res.header('Access-Control-Allow-Headers', requestHeaders);
      } else {
        res.header('Access-Control-Allow-Headers', '*');
      }
      res.header('Access-Control-Expose-Headers', '*');
      next();
    });

    app.get('/api/sync/metadata', async (req, res) => {
      const metadata = await this.syncService.getMetadata();
      res.json(metadata);
    });

    app.get('/api/sync/pull', async (req, res) => {
      const { type, id } = req.query;
      const data = await this.syncService.getItem(type, id);
      res.json(data);
    });

    app.get('/api/sync/pull-all', async (req, res) => {
      const [sessions, groups, settings, scenarios] = await Promise.all([
        this.syncService.getAll('sessions'),
        this.syncService.getItem('groups'),
        this.syncService.getItem('settings'),
        this.syncService.getItem('scenarios')
      ]);
      res.json({ sessions, groups, settings, scenarios });
    });

    app.post('/api/sync/push', express.json({ limit: '200mb' }), async (req, res) => {
      const { type, data } = req.body;
      const success = await this.syncService.saveItem(type, data);
      res.json({ success });
    });

    app.delete('/api/sync/delete', async (req, res) => {
      const { type, id } = req.query;
      const success = await this.syncService.deleteItem(type, id);
      res.json({ success });
    });

    // 静态文件服务：打包后 distPath 将指向 pkg 内部 snapshot
    // 在 pkg 环境下，__dirname 指向 backend 目录在虚拟挂载点中的位置
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));

    app.all(/(.*)/, (req, res) => {
      const isApiRequest = req.path.startsWith('/v1') ||
        req.path.startsWith('/upload') ||
        (req.method !== 'GET' && !req.path.startsWith('/api/sync')) ||
        (Object.keys(req.query).length > 0 && !req.path.startsWith('/api/sync'));

      if (isApiRequest) {
        return this.requestHandler.processRequest(req, res);
      }

      if (process.env.VITE_DEV_SERVER_URL) {
        if (req.method === 'GET' || req.method === 'HEAD') {
          return createProxyMiddleware({
            target: process.env.VITE_DEV_SERVER_URL,
            changeOrigin: true,
            ws: true,
            logLevel: 'silent'
          })(req, res);
        }
      }

      if (req.accepts('html')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }

      return this.requestHandler.processRequest(req, res);
    });

    return app;
  }

  async _startWebSocketServer() {
    this.wsServer = new WebSocket.Server({
      port: this.config.wsPort,
      host: this.config.host
    });

    this.wsServer.on('connection', (ws, req) => {
      this.connectionRegistry.addConnection(ws, {
        address: req.socket.remoteAddress
      });
    });

    this.logger.info(`WebSocket服务器启动: ws://${this.config.host}:${this.config.wsPort}`);
  }
}

async function initializeServer() {
  const serverSystem = new ProxyServerSystem();
  try {
    await serverSystem.start();
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeServer();
}

module.exports = { ProxyServerSystem, initializeServer };
