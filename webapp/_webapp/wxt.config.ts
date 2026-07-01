import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";
// See https://wxt.dev/api/config.html

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    // unplugin-icons: `import X from "~icons/lucide/x"` is inlined at build time
    // from the offline @iconify-json/lucide set — no runtime network fetch.
    plugins: [tailwindcss(), Icons({ compiler: "jsx", jsx: "react" })],
    // react-draggable's log() reads process.env.DRAGGABLE_DEBUG; MAIN world has
    // no `process` global, so replace it at build time to avoid a ReferenceError.
    define: {
      "process.env.DRAGGABLE_DEBUG": "false",
    },
  }),
  webExt: {
    chromiumArgs: ["--user-data-dir=./.wxt/chrome-data"],
  },
  manifest: {
    short_name: "PaperDbg",
    // Prod public key from paperdebugger-main (src/libs/manifest.ts). Pinning it
    // makes the unpacked dev extension's id deterministic and equal to the prod
    // id `dfkedikhakpapbfcnbpmfhpklndgiaog`, so the native-messaging manifest's
    // allowed_origins never has to change. Public key only — safe to commit.
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA551W5cYpoDBMQLSFFrGBzjcCyMtYx9NY6GEZeUzjy+fZSV9fOO4XFqw9sftHgv2MlEyruysvroexh0EJCbtasnaM1v+wwZDYNT7WVdauPJLblqpk/XAz2pyx4IQFhronvSpbtoVGDnUEB0LYZSRsKvP+ddB7ZVB9PMag7vWed+ATTKi6nRMkxzVW8Hu9iIMSiqI3vHoKvE4aEeIyZnrMMKxXzcR7+hsQzWpygDvbkwehL4oR64VleggWLlvkUEpNM/gFDL9bO9lFeAq//NZ41CoJGaQvJEdMwCh5765wgS5ibL0RcRUYLS/FxP8IR9lVT/6nBjVT+nVQ1CYavd5u6wIDAQAB",
    icons: {
      16: "icon/1024.png",
      24: "icon/1024.png",
      48: "icon/1024.png",
      96: "icon/1024.png",
      128: "icon/1024.png",
    },
    permissions: ["cookies", "storage", "scripting", "activeTab", "nativeMessaging"],
    host_permissions: ["*://*.overleaf.com/"],
    optional_host_permissions: ["*://*/*"],
    action: {
      default_popup: "popup.html",
    },
    web_accessible_resources: [
      {
        resources: ["images/*"],
        matches: ["*://*/*"],
      },
      {
        // MAIN-world UI script, injected by the ISOLATED content script
        resources: ["main-world.js"],
        matches: ["*://*/*"],
      },
    ],
  },
});
