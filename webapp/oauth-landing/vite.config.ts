import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
  ],
})
