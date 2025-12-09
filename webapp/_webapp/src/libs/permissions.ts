// can not running in content_script. registerContentScripts can only be called in service_worker.
export async function registerContentScripts(origins?: string[]) {
    try {
        const resolvedOrigins = origins ?? (await chrome.permissions.getAll()).origins ?? [];
        if (resolvedOrigins.length === 0) {
            console.log("[PaperDebugger] No origins found, skipping content script registration");
            return;
        }

        const scriptIds = (await chrome.scripting.getRegisteredContentScripts()).map(script => script.id);
        if (scriptIds.length > 0) {
            console.log("[PaperDebugger] Unregistering dynamic content scripts", scriptIds);
            await chrome.scripting.unregisterContentScripts({ ids: scriptIds });
        }

        await chrome.scripting.registerContentScripts([{
            id: "content-script-main",
            js: ["paperdebugger.js"],
            persistAcrossSessions: true,
            matches: resolvedOrigins,
            world: "MAIN",
        }, {
            id: "content-script-intermediate",
            js: ["intermediate.js"],
            persistAcrossSessions: true,
            matches: resolvedOrigins,
            runAt: "document_start"
        }]);

        console.log("[PaperDebugger] Registration complete", resolvedOrigins);
    } catch (error) {
        console.error("[PaperDebugger] Failed to register content scripts", error);
    }
}
