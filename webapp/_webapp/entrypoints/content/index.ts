export default defineContentScript({
  matches: ['*://*.overleaf.com/*'],
  main() {
    console.log('[PaperDebugger] Hello content.');
  },
});
