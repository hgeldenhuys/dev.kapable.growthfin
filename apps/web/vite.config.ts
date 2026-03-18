import path from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [reactRouter()],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "~": path.resolve(__dirname, "./app"),
    },
  },
  server: {
    host: '0.0.0.0', // Bind to all network interfaces (accessible from local network)
    port: 5173,
    strictPort: true, // Fail if port 5173 is not available (don't auto-increment)
    hmr: {
      // Configure HMR to be more stable
      overlay: true, // Keep overlay for debugging but can set to false if annoying
      timeout: 60000, // Increase timeout to 60 seconds
    },
    // NOTE: We don't proxy /api here - React Router handles it via api.$.ts
    // This prevents conflicts between Vite proxy and React Router proxy
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', 'm4.local', 'de4fc999c637.ngrok-free.app', 'newleads.co.za', 'www.newleads.co.za'],
  },
  // Prevent connection timeout issues in development
  optimizeDeps: {
    exclude: ['@react-router/dev'],
  },
  // SSR configuration to handle ESM/CJS compatibility
  ssr: {
    // Externalize CJS packages to avoid bundling issues
    external: [
      'react-syntax-highlighter',
      'refractor',
      'lowlight',
      'highlight.js',
      'prismjs',
    ],
  },
});