import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import { produce } from "immer";
import path from "path";
import { defineConfig, Plugin, type UserConfig } from "vite";
import { getManifest } from "./src/libs/manifest";

function generateConfig(
  entry: string,
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updater?: (config: any) => void,
): UserConfig {
  return produce<UserConfig>(
    {
      base: "/_pd/webapp",
      plugins: [react()],
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
    },
    (draft) => updater?.(draft),
  );
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
