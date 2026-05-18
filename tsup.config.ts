import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'bin/ds-code.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: true,
  shims: false,
  banner: {
    js: '',
  },
})
