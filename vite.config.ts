import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'

import { defineConfig, lazyPlugins, type Plugin } from 'vite-plus'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

const PAGES_MAX_FILE_BYTES = 25 * 1024 * 1024
const ORT_WASM_ASSET_URL =
  /new URL\(\s*["']ort-wasm[^"']*\.wasm["']\s*,\s*import\.meta\.url\s*\)/g

function listFiles(dir: string): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function isOrtWasmAsset(fileName: string): boolean {
  const baseName = fileName.split(/[/\\]/).pop() ?? fileName
  return baseName.startsWith('ort-wasm') && baseName.endsWith('.wasm')
}

/**
 * onnxruntime-web uses `new URL('ort-wasm…wasm', import.meta.url)`, which Vite
 * copies into dist (~26 MiB). Cloudflare Pages rejects files over 25 MiB.
 * Runtime loads that WASM from jsDelivr via `env.backends.onnx.wasm.wasmPaths`.
 */
function stripOrtWasm(): Plugin {
  let outDir = ''

  return {
    name: 'strip-ort-wasm',
    enforce: 'pre',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      if (!outDir.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(outDir)) {
        outDir = join(config.root, outDir)
      }
    },
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/')
      if (!normalizedId.includes('onnxruntime-web')) {
        return
      }
      if (normalizedId.includes('.wasm')) {
        return
      }
      const replaced = code.replace(ORT_WASM_ASSET_URL, 'new URL("data:,")')
      if (replaced !== code) {
        return replaced
      }
    },
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (isOrtWasmAsset(fileName)) {
          delete bundle[fileName]
        }
      }
    },
    closeBundle() {
      if (!outDir) {
        return
      }
      for (const filePath of listFiles(outDir)) {
        if (isOrtWasmAsset(filePath)) {
          unlinkSync(filePath)
          continue
        }
        const size = statSync(filePath).size
        if (size > PAGES_MAX_FILE_BYTES) {
          const sizeMiB = (size / 1024 / 1024).toFixed(1)
          throw new Error(
            `Cloudflare Pages rejects files over 25 MiB. ${filePath} is ${sizeMiB} MiB.`,
          )
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'],
  },
  plugins: lazyPlugins(() => [
    stripOrtWasm(),
    devtools(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    viteReact(),
    tailwindcss(),
  ]),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
    plugins: () => [stripOrtWasm()],
  },
})
