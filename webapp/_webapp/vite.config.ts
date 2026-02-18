import faroUploader from "@grafana/faro-rollup-plugin";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { defineConfig, Plugin, type UserConfig } from "vite";
import { getManifest } from "./src/libs/manifest";
import tailwindcss from '@tailwindcss/vite'

function generateConfig(
  entry: string,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updater?: (config: any) => void,
): UserConfig {
  const config: UserConfig = {
    base: "/_pd/webapp",
    plugins: [
      tailwindcss(),
      react(),
      faroUploader({
        appName: "PaperDebugger",
        endpoint: "https://faro-api-prod-ap-southeast-1.grafana.net/faro/api/v1",
        appId: "921",
        stackId: "1466738",
        verbose: true,
        // instructions on how to obtain your API key are in the documentation
        // https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/sourcemap-upload-plugins/#obtain-an-api-key
        apiKey:
          process.env.GRAFANA_API_KEY ||
          "glc_eyJvIjoiMTYxNTMzNCIsIm4iOiJwYXBlcmRlYnVnZ2VyLXNvdXJjZW1hcC1hY2Nlc3MtcG9saWN5LWNocm9tZS1leHRlbnNpb24iLCJrIjoiMzc4MnUzUDY1WjgyaVlpaGhEdUl0d0wxIiwibSI6eyJyIjoicHJvZC1hcC1zb3V0aGVhc3QtMSJ9fQ==",
        gzipContents: true,
      }) as Plugin,
    ],
    esbuild: {
      charset: "ascii",
    },
    define: {
      "process.env": {
        PD_API_ENDPOINT: process.env.PD_API_ENDPOINT || "",
        PD_GA_TRACKING_ID: process.env.PD_GA_TRACKING_ID || "G-6Y8G18CCMP",
        PD_GA_API_SECRET: process.env.PD_GA_API_SECRET || "V6Cpx7cJRlK_W2j2LWx7yw",
        BETA_BUILD: process.env.BETA_BUILD || "false",
        VERSION: process.env.VERSION,
        MONOREPO_REVISION: process.env.MONOREPO_REVISION,
        SAFARI_BUILD: process.env.SAFARI_BUILD || "false",
      },
    },
    build: {
      emptyOutDir: false,
      cssCodeSplit: true,
      copyPublicDir: false,
      lib: {
        entry: entry,
        name: name,
        formats: ["iife"],
        fileName: () => `${name}.js`,
      },
      sourcemap: true,
    },
  };

  updater?.(config);
  return config;
}

function generateManifestPlugin(): Plugin {
  let outDir: string;

  return {
    name: "generate-manifest",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const manifest = getManifest();
      fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    },
  };
}

function generateOfficeBundleCopyPlugin(targetPath: string): Plugin {
  let outDir: string;

  return {
    name: "copy-office-bundle",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const sourcePath = path.join(outDir, "office.js");
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    },
  };
}

const configs: Record<string, UserConfig> = {
  default: generateConfig("./src/main.tsx", "paperdebugger", (draft) => {
    draft.build.copyPublicDir = true;
    draft.plugins.push(generateManifestPlugin());
  }),
  office: generateConfig("./src/views/office/app.tsx", "office", (draft) => {
    draft.build.emptyOutDir = true;
    draft.build.outDir = "dist/office";
    draft.plugins.push(
      generateOfficeBundleCopyPlugin(path.resolve(process.cwd(), "../office/src/paperdebugger/office.js")),
    );
  }),
  background: generateConfig("./src/background.ts", "background"),
  intermediate: generateConfig("./src/intermediate.ts", "intermediate"),
  settings: generateConfig("./src/views/extension-settings/app.tsx", "settings"),
  popup: generateConfig("./src/views/extension-popup/app.tsx", "popup"),
};

const viteConfig = process.env.VITE_CONFIG || "default";
const config = configs[viteConfig] ?? configs.default;

// https://vite.dev/config/
export default defineConfig(config);
