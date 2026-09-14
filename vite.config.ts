import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function localGroupPlanApiPlugin() {
  let apiProcess: ChildProcess | undefined
  return {
    name: 'zouzou-local-group-plan-api',
    configureServer(server: { httpServer?: { once: (event: 'close', listener: () => void) => void } }) {
      const tsx = resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs')
      apiProcess = spawn(process.execPath, [tsx, 'server/index.ts'], { cwd: process.cwd(), env: process.env, stdio: 'ignore', windowsHide: true })
      apiProcess.on('error', (error) => console.error('[zouzou] 计划服务启动失败', error.message))
      apiProcess.on('exit', (code) => { if (code && code !== 0) console.error(`[zouzou] 计划服务退出，状态码 ${code}`) })
      server.httpServer?.once('close', () => { apiProcess?.kill(); apiProcess = undefined })
    },
  }
}

export default defineConfig(({ command, isSsrBuild }) => ({
  resolve: {
    // Only the browser production build substitutes the synchronous reader.
    // Vitest, the Node API and Wrangler keep the complete server knowledge base.
    alias: command === 'build' && !isSsrBuild ? [{
      find: /^(?:\.\.?\/)+(?:services\/trip\/|trip\/)?localGuides(?:\.ts)?$/,
      replacement: resolve(process.cwd(), 'src/services/trip/clientGuides.ts'),
    }] : [],
  },
  plugins: [react(), localGroupPlanApiPlugin()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    port: 4173,
    strictPort: false,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  preview: { port: 4173, proxy: { '/api': 'http://127.0.0.1:8787' } },
}))
