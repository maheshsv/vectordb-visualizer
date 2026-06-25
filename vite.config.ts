import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Transformers.js ships large WASM/ONNX chunks; keep them out of the warning path.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 4096,
  },
  worker: {
    format: 'es',
  },
});
