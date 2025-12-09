// can not running in content_script. registerContentScripts can only be called in service_worker.
export async function registerContentScripts() {
    const origins = (await chrome.permissions.getAll()).origins || [];
    const scriptIds = (await chrome.scripting.getRegisteredContentScripts()).map(script => script.id);

    console.log("[PaperDebugger] Unregistering dynamic content scripts", scriptIds);
    await chrome.scripting.unregisterContentScripts({ ids: scriptIds });

    await chrome.scripting.registerContentScripts([{
        id: "content-script-main",
        js: ["paperdebugger.js"],
        persistAcrossSessions: true,
        matches: origins,
        world: "MAIN",
    }, {
        id: "content-script-intermediate",
        js: ["intermediate.js"],
        persistAcrossSessions: true,
        matches: origins,
        runAt: "document_start"
    }])

    console.log("[PaperDebugger] Registration complete", origins);
}
