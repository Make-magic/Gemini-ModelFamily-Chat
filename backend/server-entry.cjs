// version 2.3.1
const { ProxyServerSystem } = require('./local-server.cjs');
const { exec } = require('child_process');
const path = require('path');

// 生产环境配置
const PORT = 3000;
const HOST = '0.0.0.0';
const LOCAL_URL = `http://localhost:${PORT}`;

async function startProductionServer() {
    console.log('--------------------------------------------------');
    console.log('--- All Model Chat - 正在启动本地应用引擎 ---');
    console.log('--------------------------------------------------');

    const server = new ProxyServerSystem({
        httpPort: PORT,
        wsPort: 9998,
        host: HOST
    });

    try {
        server.on('started', () => {
            console.log(`\n[SUCCESS] 服务已在端口 ${PORT} 启动!`);
            console.log(`[ACCESS] 访问地址: ${LOCAL_URL}`);
            console.log(`\n[AUTO] 正在为您打开默认浏览器...`);

            openBrowser(LOCAL_URL);
        });

        await server.start();
    } catch (err) {
        console.error('[ERROR] 启动失败:', err.message);
        if (err.code === 'EADDRINUSE') {
            console.error(`[FATAL] 端口 ${PORT} 已被占用，请先关闭其他实例。`);
        }
        process.exit(1);
    }
}

function openBrowser(url) {
    let command;
    switch (process.platform) {
        case 'darwin':
            command = `open "${url}"`;
            break;
        case 'win32':
            command = `start "" "${url}"`;
            break;
        default:
            command = `xdg-open "${url}"`;
            break;
    }

    exec(command, (error) => {
        if (error) {
            console.error('无法自动打开浏览器:', error.message);
            console.log(`请手动访问: ${url}`);
        }
    });
}

// 启动
startProductionServer();
