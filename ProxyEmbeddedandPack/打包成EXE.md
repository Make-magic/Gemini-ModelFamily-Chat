# 项目打包指南 (EXE)

本文档记录了将本项目打包成独立 EXE 文件的步骤和配置。

## 1. 核心原理

使用 [pkg](https://github.com/vercel/pkg) 工具将 Node.js 运行时、后端服务代码以及构建好的前端静态资源（`dist` 目录）打包成一个独立的可执行文件 (`.exe`)。

## 2. 关键文件变更

### 2.1 新增生产环境入口
创建了 `backend/server-entry.cjs`，主要功能包括：
- **硬编码配置**：设置生产环境端口为 `3000`，Host 为 `127.0.0.1`。
- **启动服务**：实例化 `ProxyServerSystem` 并启动。
- **自动打开浏览器**：监听服务启动事件，使用 `child_process.exec` 调用系统命令（`start` on Windows, `open` on Mac, `xdg-open` on Linux）自动打开默认浏览器访问服务地址。

### 2.2 package.json 配置变更
在 `package.json` 中添加了以下配置以支持打包：

1.  **bin 入口**:
    ```json
    "bin": "backend/server-entry.cjs"
    ```

2.  **pkg 配置**:
    ```json
    "pkg": {
      "scripts": [
        "backend/**/*.cjs", // 包含后端脚本
        "backend/**/*.js"
      ],
      "assets": [
        "dist/**/*"         // 包含前端构建产物
      ],
      "targets": [
        "node18-win-x64"    // 目标平台：Windows x64, Node 18
      ]
    }
    ```

3.  **Scripts 脚本**:
    ```json
    "scripts": {
      "package": "npm run build && pkg . --out-path release"
    }
    ```
    该脚本首先运行 `build` 生成前端静态资源，然后运行 `pkg` 进行打包。

## 3. 如何执行打包

在项目根目录下，打开终端并运行以下命令：

```bash
npm run package
```

**执行流程：**
1.  Vite 开始构建前端代码，生成的静态文件存放在 `dist/` 目录。
2.  Pkg 读取 `package.json` 配置，将 Node.js 运行时、`backend/server-entry.cjs` 及其依赖、以及 `dist/` 中的资源文件打包。
3.  生成的 `.exe` 文件输出到 `release/` 目录。

## 4. 产物与运行

- **产物位置**: `d:\Code.Env\JSAPP\AMC18\release\all-model-chat.exe`
- **分发**: 该 exe 文件是独立的，可以直接发送给其他 Windows 用户，对方无需安装 Node.js 或配置环境。
- **运行**: 双击 exe 文件，会出现一个控制台窗口显示服务日志，稍后会自动弹出浏览器访问应用。关闭控制台窗口即可停止服务。

## 5. 注意事项

- **动态加载**: 如果代码中有 `require(variable)` 这种动态引用的写法，`pkg` 可能无法自动检测到依赖，需要在 `package.json` 的 `pkg.scripts` 中显式包含。
- **资源路径**: 代码中读取文件系统时（如 `fs.readFile`），若需读取打包在 exe 内部的资源，应使用 `path.join(__dirname, '...')`，`pkg` 会自动处理 snapshot 文件系统。

## 6. 常见问题排查

### 6.1 Windows 下无法自动打开浏览器
**问题现象**：启动 exe 后，没有打开浏览器，而是弹出了一个新的控制台窗口，标题为 `http://127.0.0.1:3000`。

**原因分析**：在 Windows `cmd` 环境下，`start` 命令会将第一个带引号的参数误认为是窗口标题。

**解决方案**：在 `backend/server-entry.cjs` 的 `openBrowser` 函数中，将 `start` 命令修改为：
```javascript
command = `start "" "${url}"`;
```
通过传入一个空的引号 `""` 作为第一个参数（标题），确保 URL 被正确识别为启动目标。
