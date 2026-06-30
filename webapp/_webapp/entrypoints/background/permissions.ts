const DYNAMIC_ID = 'pd-dynamic';

// overleaf 由静态 content.ts 覆盖，这里只为额外授权的自托管域名动态注册同一个
// content script。MAIN world UI 还没迁过来，等迁移时再往数组里加第二项。
export async function syncContentScripts() {
  try {
    const { origins = [] } = await browser.permissions.getAll();
    const matches = origins.filter((o) => !o.includes('overleaf.com'));

    const existing = await browser.scripting.getRegisteredContentScripts({ ids: [DYNAMIC_ID] });
    if (existing.length) await browser.scripting.unregisterContentScripts({ ids: [DYNAMIC_ID] });
    if (!matches.length) return;

    await browser.scripting.registerContentScripts([
      {
        id: DYNAMIC_ID,
        js: ['content-scripts/content.js'],
        matches,
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
    console.log('[PaperDebugger] dynamic content scripts registered', matches);
  } catch (error) {
    console.error('[PaperDebugger] Failed to register content scripts', error);
  }
}
