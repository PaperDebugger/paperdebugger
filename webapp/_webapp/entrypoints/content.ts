export default defineContentScript({
  matches: ['*://*.overleaf.com/*'],
  main() {
    console.log('Hello content.');
  },
});
