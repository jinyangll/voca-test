import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 개발: uvicorn backend.main:app --port 8000
    proxy: { '/api': 'http://localhost:8000' },
  },
})
