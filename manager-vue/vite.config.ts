import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 自定义插件：复制图标文件到构建目录
const copyIconsPlugin = () => {
  return {
    name: 'copy-icons',
    writeBundle() {
      const iconsDir = resolve(__dirname, 'src/assets/icons')
      const distIconsDir = resolve(__dirname, '../manager-worker/dist/icons')

      // 创建目标目录
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true })
      }

      // 复制所有图标文件
      const iconFiles = [
        'codebuddy.svg',
        'cursor.svg',
        'kiro.svg',
        'qoder.svg',
        'trae.svg',
        'vscode.svg',
        'vscodium.svg'
      ]

      iconFiles.forEach(file => {
        const src = resolve(iconsDir, file)
        const dest = resolve(distIconsDir, file)
        if (existsSync(src)) {
          copyFileSync(src, dest)
          console.log(`Copied ${file} to manager-worker/dist/icons/`)
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      vue(),
      vueDevTools(),
      copyIconsPlugin(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      outDir: '../manager-worker/dist',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0', // 允许外部IP访问
      port: 5173,      // 指定端口
      proxy: {
        '/api': {
          // 开发环境：连接到新的 Express.js 后端 (manager-server) - 端口 6000
          // 如需连接到旧的 Cloudflare Worker，改为 http://localhost:8787
          target: 'http://localhost:6000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
