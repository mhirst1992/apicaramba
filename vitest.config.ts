import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/*/tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**']
    }
  }
})
