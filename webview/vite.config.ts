import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidebar: './index.html'
      },
      output: {
        entryFileNames: 'sidebar.[name].js',
        chunkFileNames: 'sidebar.[name].js',
        assetFileNames: 'sidebar.[name].[ext]'
      }
    }
  }
});
