const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { SyncService, ConnectionRegistry, LoggingService, createSyncRouter } = require('./backend/sync-server.cjs');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Sync Services
const logger = new LoggingService('ProdSync');
const connectionRegistry = new ConnectionRegistry(logger);
const syncService = new SyncService(logger, connectionRegistry);

syncService.init().then(() => {
  logger.info('Sync Service Initialized for Production');
});

// Setup Sync API routes
app.use('/api/sync', createSyncRouter(syncService));

// Setup WebSocket for Sync
const wsServer = new WebSocket.Server({ server });
wsServer.on('connection', (ws, req) => {
  connectionRegistry.addConnection(ws, {
    address: req.socket.remoteAddress
  });
});

// 托管 Vite 构建的静态资源目录
app.use(express.static(path.join(__dirname, 'dist')));

// 适配 SPA（单页面应用）前端路由
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`本地服务已启动: http://localhost:${PORT}`);
});