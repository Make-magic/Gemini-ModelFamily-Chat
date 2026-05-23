const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 托管 Vite 构建的静态资源目录
app.use(express.static(path.join(__dirname, 'dist')));

// 适配 SPA（单页面应用）前端路由
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`本地服务已启动: http://localhost:${PORT}`);
});