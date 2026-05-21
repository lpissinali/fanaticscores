import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        // api-football.com v3 -- adds the API key header so the key is never in client bundles.
        '/api/af': {
          target:       'https://v3.football.api-sports.io',
          changeOrigin: true,
          rewrite:      (path) => path.replace(/^\/api\/af/, ''),
          headers: {
            'x-apisports-key': env.VITE_AF_API_KEY ?? '',
          },
        },
        // On-demand matchday fetch (Cloud Function) for non-today dates.
        '/api/fetchMatchday': {
          target:       'https://us-central1-fanaticscores-b6af4.cloudfunctions.net',
          changeOrigin: true,
          rewrite:      (path) => path.replace(/^\/api\/fetchMatchday/, '/fetchMatchdayHttp'),
        },
      },
    },
  }
})
