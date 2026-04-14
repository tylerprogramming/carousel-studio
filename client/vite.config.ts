import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    allowedHosts: ['choice-entirely-coyote.ngrok-free.app'],
    proxy: {
      '/api': 'http://localhost:3010',
      '/files': 'http://localhost:3010',
    },
  },
})
