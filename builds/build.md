# 项目打包为单一 EXE 方案

鉴于当前项目是一个纯前端的 Vite + React Web 应用，且明确要求**不是本地桌面应用（如 C#/C++）或 Electron 应用**，要将其打包为单一的 `.exe` 文件，最佳方案是使用 **Node.js 配合 `pkg`**。

该方案的原理是：编写一个轻量级的 Node.js Web 服务器（如 Express）来托管 Vite 打包后的 `dist` 静态资源，然后使用 `pkg` 将这个 Node.js 服务器以及前端静态文件一并打包成一个独立的 `.exe` 可执行文件。用户双击运行该 `.exe` 时，会在本地启动服务器并自动在默认浏览器中打开网页。

## 1. 准备工作

首先，安装所需的依赖：用于提供 Web 服务的 `express`、用于自动打开浏览器的 `open`，以及用于打包为 exe 的 `pkg`。

```bash
npm install express open
npm install -D pkg
```

## 2. 创建服务器脚本

在项目根目录下创建一个 `server.js` 文件，用于启动服务并托管 `dist` 目录：

```javascript
const express = require('express');
const path = require('path');
const open = require('open');

const app = express();
const PORT = process.env.PORT || 3000;

// 托管 Vite 构建的静态资源目录
app.use(express.static(path.join(__dirname, 'dist')));

// 适配 SPA（单页面应用）前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`本地服务已启动: http://localhost:${PORT}`);
  console.log('正在浏览器中打开...');
  // 自动在系统默认浏览器中打开该地址
  await open(`http://localhost:${PORT}`);
});
```

## 3. 修改 package.json 配置

在 `package.json` 中添加 `bin` 入口和 `pkg` 静态资源配置，以确保 `dist` 文件夹在打包时被包含进去。

在 `package.json` 的顶层添加如下配置：

```json
{
  "bin": "server.js",
  "pkg": {
    "assets": [
      "dist/**/*"
    ]
  }
}
```

## 4. 最终的打包命令

在执行打包生成 `.exe` 之前，必须先执行前端的构建命令生成 `dist` 目录，然后调用 `pkg`。

```bash
# 1. 构建前端生产环境静态资源
npm run build

# 2. 将 Node.js 服务与静态资源打包成单一的 Windows 可执行文件 (exe)
npx pkg . --targets node18-win-x64 --output builds/app.exe
```

执行完毕后，您将在 `builds/` 目录下得到一个 `app.exe` 文件。双击该文件即可在非 Electron 且无需额外本地环境配置的情况下运行您的 Web 应用。

## 5. 输出压缩后的 Build

如果您希望进一步压缩生成的 `.exe` 文件体积，有以下两种主要方式：

### 方式一：使用 pkg 内置的压缩参数（推荐）
`pkg` 提供了 `--compress` 选项，可以使用 `GZip` 或 `Brotli` 算法对捆绑的虚拟文件系统（您的代码和前端静态资源）进行压缩。

```bash
# 采用 Brotli 算法压缩构建
npx pkg . --targets node18-win-x64 --compress Brotli --output builds/app.exe
```

### 方式二：使用 UPX 对生成的 exe 进行二进制压缩
即使使用了 `pkg` 的 `--compress`，Node.js 运行时的二进制核心依然占据大量体积。您可以使用开源的 [UPX (Ultimate Packer for eXecutables)](https://upx.github.io/) 进行极限压缩。通常可以将生成的 `.exe` 体积缩小 **50% - 70%**。

1. 首先下载 UPX 并将其加入系统环境变量，或直接将 `upx.exe` 放在项目目录中。
2. 运行压缩命令：
```bash
# 执行最高级别的二进制压缩
upx -9 builds/app.exe
```

> **补充说明：前端资源压缩**
> 如果您还想进一步压缩打包入 `.exe` 内的前端产物本身，可以在构建前端代码时引入 Vite 插件（如 `vite-plugin-compression`），但由于该应用最终是在用户本地作为服务器运行的（网络传输开销几乎为零），专门对前端代码进行 Gzip 意义不大。通过 `pkg --compress Brotli` 以及 `UPX` 处理 `.exe` 本身已经足以实现最大程度的体积优化。
