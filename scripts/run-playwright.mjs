import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const preview = spawn(process.execPath, [
  './node_modules/vite/bin/vite.js',
  'preview',
  '--host', '127.0.0.1',
  '--port', '4173',
], { stdio: 'inherit', windowsHide: true });

const stopPreview = () => {
  if (!preview.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    preview.kill('SIGTERM');
  }
};

const waitForServer = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:4173');
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for the Vite preview server.');
};

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise(resolve => {
    const runner = spawn(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test'], {
      stdio: 'inherit',
      windowsHide: true,
      env: process.env,
    });
    runner.on('exit', code => resolve(code ?? 1));
  });
} finally {
  stopPreview();
}

process.exit(exitCode);
