// MAIN world. Has page JS (Overleaf's cmView etc.) but NO chrome.runtime —
// reach the background through the ISOLATED bridge (lib/intermediate makeFunction).
import { getUrl } from '@/lib/intermediate';

export default defineUnlistedScript(async () => {
  console.log('[PaperDebugger] main-world script loaded');

  // ponytail: placeholder UI — a top-left badge. Real React panel lands with the
  // UI migration; this just proves the MAIN-world script mounts into the page.
  const badge = document.createElement('div');
  badge.id = 'paperdebugger-root';
  badge.textContent = 'PaperDebugger';
  badge.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:2147483647;padding:4px 8px;' +
    'font:600 12px/1 Inter,system-ui,sans-serif;color:#fff;background:#1f7aec;' +
    'border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:default;';
  document.body.appendChild(badge);

  // Smoke-test the bridge end-to-end via a real handler (MAIN -> ISOLATED ->
  // background -> back).
  try {
    const url = await getUrl('/main-world.js');
    console.log('[PaperDebugger] bridge getUrl ok', url);
  } catch (err) {
    console.error('[PaperDebugger] bridge getUrl failed', err);
  }
});
