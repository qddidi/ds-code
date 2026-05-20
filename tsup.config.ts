import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'bin/ds-code.tsx'],
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
