/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base はプロジェクトページ (https://gyakusu.github.io/hidden-coefficients/) 用。
// 別ホスティングに移す場合はここを '/' などに変更する。
export default defineConfig({
  base: '/hidden-coefficients/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
