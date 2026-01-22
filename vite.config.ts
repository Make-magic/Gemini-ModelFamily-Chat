
import path from 'path';
import { spawn } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function startLocalServer() {
  return {
    name: 'start-local-server',
    configureServer(server) {
      const child = spawn('node', ['backend/local-server.cjs'], {
        stdio: 'inherit',
        shell: true,
      });

      server.httpServer.on('close', () => {
        child.kill();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      strictPort: true,
    },
    plugins: [react(), startLocalServer()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        // __dirname is not available in ES modules.
        // We'll resolve from the current working directory.
        '@': path.resolve('.'),
      }
    }
  };
});
