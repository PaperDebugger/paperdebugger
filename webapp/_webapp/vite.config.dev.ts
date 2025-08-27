import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

// 简化的开发配置
export default defineConfig({
  root: "src/devtool",
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // 代理API请求到后端
      "/oauth2": {
        target: process.env.PD_API_ENDPOINT || "http://localhost:6060",
        changeOrigin: true,
        secure: false,
      },
      "/_pd/api": {
        target: process.env.PD_API_ENDPOINT || "http://localhost:6060",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io/1/": {
        target: "https://www.overleaf.com",
        changeOrigin: true,
        secure: false,
        headers: {
          Origin: "https://www.overleaf.com",
        },
      },
      "/socket.io/1/websocket/": {
        target: "https://www.overleaf.com",
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: {
          Origin: "https://www.overleaf.com",
        },
      },
    },
  },
  define: {
    "process.env": {
      PD_API_ENDPOINT: process.env.PD_API_ENDPOINT || "",
      PD_GA_TRACKING_ID: "NOT_ENABLED_IN_DEV",
      PD_GA_API_SECRET: "NOT_ENABLED_IN_DEV",
    },
  },
  esbuild: {
    charset: "ascii",
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/devtool/index.html"),
      },
    },
  },
});
