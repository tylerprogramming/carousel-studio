import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Extra hostnames allowed to reach the dev server, e.g. an ngrok tunnel used to
// open the app on an iPad. Set VITE_ALLOWED_HOSTS to a comma-separated list.
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    allowedHosts,
    proxy: {
      '/api': 'http://localhost:3010',
      '/files': 'http://localhost:3010',
      // Export links point at /carousel-output/<slug>/… — without this the dev
      // server answers them with index.html and the downloads silently fail.
      '/carousel-output': 'http://localhost:3010',
    },
  },
})
