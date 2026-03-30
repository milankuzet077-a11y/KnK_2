import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version?: string }
const appBuildVersion = process.env.VERCEL_GIT_COMMIT_SHA || packageJson.version || '0.0.1'

function buildMetricsPlugin(): Plugin {
  return {
    name: 'build-metrics-report',
    generateBundle(_, bundle) {
      const report = Object.entries(bundle)
        .map(([fileName, chunk]) => {
          const size = 'code' in chunk ? Buffer.byteLength(chunk.code) : typeof chunk.source === 'string' ? Buffer.byteLength(chunk.source) : chunk.source.byteLength
          return { fileName, type: chunk.type, size }
        })
        .sort((a, b) => b.size - a.size)

      writeFileSync(resolve(process.cwd(), 'dist', 'build-metrics.json'), JSON.stringify(report, null, 2))
    },
  }
}

export default defineConfig({
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(appBuildVersion),
  },
  plugins: [react(), buildMetricsPlugin()],
  build: {
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-router-dom')) return 'router'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react'
          if (id.includes('three/examples/jsm/loaders/GLTFLoader.js')) return 'engine3d-loader'
          if (id.includes('/src/engine3d/modelLoader')) return 'engine3d-assets'
          if (id.includes('/src/engine3d/materials/')) return 'engine3d-materials'
          if (id.includes('/src/engine3d/sceneRuntime') || id.includes('/src/engine3d/sceneLayout') || id.includes('/src/engine3d/selection')) return 'engine3d-runtime'
          if (id.includes('/src/engine3d/Canvas3D') || id.includes('/src/engine3d/renderItems') || id.includes('/src/engine3d/itemPlacement')) return 'configurator-3d'
          if (id.includes('/three/')) return 'engine3d-core'
          if (id.includes('/src/ui/Step3Configurator')) return 'step3'
          if (id.includes('/uuid/')) return 'vendor'
          return undefined
        },
      },
    },
  },
  server: { port: 5173 },
})
