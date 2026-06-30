// ISOLATED world. Importing the intermediate module registers, as a side
// effect, the chrome.runtime bridge listeners for every makeFunction handler.
import "@/lib/intermediate";
import "@/lib/chat-stream"; // registers the streamed-chat relay (ISOLATED side)

export default defineContentScript({
  matches: ["*://*.overleaf.com/*"],
  async main() {
    console.log("[PaperDebugger] content (ISOLATED) loaded");

    // Run the UI in MAIN world so it can reach Overleaf's page JS (cmView, ...).
    await injectScript("/main-world.js", { keepInDom: true });
  },
});
