// version 2.3.0
const { ProxyServerSystem } = require('./local-server.cjs');
const { exec } = require('child_process');
const path = require('path');

// 生产环境配置
const PORT = 3000;
const HOST = '0.0.0.0';
const URL = `http://${HOST}:${PORT}`;

async function startProductionServer() {
    console.log('正在启动应用...');

    // 1. 启动服务器
    const server = new ProxyServerSystem({
        httpPort: PORT,
        wsPort: 9998, // 保持 WS 端口不变，或者也可以改为动态
        host: HOST
    });

    try {
        server.on('started', () => {
            console.log(`\n服务已启动!`);
            console.log(`访问地址: ${URL}`);
            console.log(`\n正在自动打开浏览器...`);

            openBrowser(URL);
        });

        await server.start();
    } catch (err) {
        console.error('启动失败:', err);
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
