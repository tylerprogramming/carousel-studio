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
    // index.css declares @font-face against ../../fonts, which is outside the
    // client root. Vite refuses to serve above the root in dev unless the path
    // is allowed, and the failure looks like the fonts silently not loading.
    // The build has no such restriction; this is dev-only.
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3010',
      '/files': 'http://localhost:3010',
      // Export links point at /carousel-output/<slug>/… — without this the dev
      // server answers them with index.html and the downloads silently fail.
      '/carousel-output': 'http://localhost:3010',
      // Same trap for the local image library: the SPA fallback returns HTML
      // where an <img> expects a PNG, so backgrounds render as broken icons.
      '/local-images': 'http://localhost:3010',
    },
  },
})
