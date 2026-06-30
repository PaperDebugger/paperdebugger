import { defineConfig } from 'wxt';
import { defineWebExtConfig } from 'wxt';
// See https://wxt.dev/api/config.html

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
  manifest: {
    short_name: "PaperDbg",
    icons: {
      16: "icon/1024.png",
      24: "icon/1024.png",
      48: "icon/1024.png",
      96: "icon/1024.png",
      128: "icon/1024.png"
    },
    permissions: ["cookies", "storage", "scripting", "activeTab"],
    host_permissions: ["*://*.overleaf.com/"],
    optional_host_permissions: ["*://*/*"],
    action: {
      default_popup: "popup.html",
    },
    web_accessible_resources: [
      {
        resources: ["images/*"],
        matches: ["*://*/*"]
      },
      {
        // MAIN-world UI script, injected by the ISOLATED content script
        resources: ["main-world.js"],
        matches: ["*://*/*"]
      }
    ]
  }
});
