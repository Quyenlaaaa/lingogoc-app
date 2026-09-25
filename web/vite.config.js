import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function catalogManifest() {
  return {
    name: 'lingogoc-catalog-manifest',
    generateBundle() {
      const catalogSource = readFileSync(new URL('./src/data/vocabData.js', import.meta.url))
      const contentHash = createHash('sha256').update(catalogSource).digest('hex')
      this.emitFile({
        type: 'asset',
        fileName: 'catalog-manifest.json',
        source: `${JSON.stringify({
          schemaVersion: 1,
          catalogVersion: contentHash.slice(0, 16),
          contentHash,
          wordCount: 3000,
        }, null, 2)}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), catalogManifest()],
  server: {
    port: 5173,
    open: true
  }
})
