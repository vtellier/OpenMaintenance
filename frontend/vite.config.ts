import path from 'node:path'
import { defineConfig } from 'vite'

const arrowPackages = [
  '@arrow-js/core',
  '@arrow-js/framework',
  '@arrow-js/hydrate',
  '@arrow-js/ssr',
]

export default defineConfig(({ isSsrBuild }) => ({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  optimizeDeps: {
    exclude: arrowPackages,
  },
  ssr: {
    noExternal: arrowPackages,
  },
  build: {
    outDir: isSsrBuild ? 'dist/server' : 'dist/client',
    emptyOutDir: !isSsrBuild,
    rollupOptions: {
      input: isSsrBuild
        ? path.resolve(__dirname, 'src/entry-server.ts')
        : path.resolve(__dirname, 'index.html'),
      output: isSsrBuild
        ? {
            entryFileNames: 'entry-server.js',
          }
        : undefined,
    },
  },
}))
