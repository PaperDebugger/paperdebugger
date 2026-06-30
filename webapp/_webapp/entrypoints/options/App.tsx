import { useCallback, useEffect, useState } from "react";
import "./App.css";

type MessageType = "success" | "error" | "info";
interface PermissionMessage {
  text: string;
  type: MessageType;
}

// Normalize a user-entered URL/wildcard into a Chrome host-permission pattern
// (<scheme>://<host><path>). Kept verbatim from the old webapp — it's the one
// security-sensitive piece here.
function normalizeWildcardPattern(url: string): { valid: true; origin: string } | { valid: false; error: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter a URL" };
  }

  const hostPermissionPattern = /^(\*|https?):\/\/((?:\*\.)?[^/\s]+)(\/.*)?$/i;
  const match = trimmed.match(hostPermissionPattern);

  if (match) {
    const scheme = match[1].toLowerCase();
    const host = match[2];
    const path = match[3] || "/*";
    const normalizedScheme = scheme === "*" ? "*" : scheme;
    const normalizedPath = path === "/" ? "/*" : path.endsWith("/*") ? path : `${path}/*`;
    return { valid: true, origin: `${normalizedScheme}://${host}${normalizedPath}` };
  }

  try {
    const urlObj = new URL(trimmed);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { valid: false, error: "URL must start with http://, https://, or *://" };
    }
    return { valid: true, origin: `${urlObj.protocol}//${urlObj.host}/*` };
  } catch {
    return {
      valid: false,
      error:
        "Invalid URL. Use a full URL (e.g., https://example.com) or a wildcard pattern (e.g., https://*.example.com/*, *://*.example.com/*)",
    };
  }
}

function App() {
  const [permissionUrl, setPermissionUrl] = useState("");
  const [origins, setOrigins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<PermissionMessage | null>(null);

  const loadPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await browser.permissions.getAll();
      setOrigins(all.origins ?? []);
    } catch (error) {
      console.error("[PaperDebugger] Error loading permissions.", error);
      setMessage({ text: "Error loading permissions.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const submit = useCallback(async () => {
    const validation = normalizeWildcardPattern(permissionUrl);
    if (!validation.valid) {
      setMessage({ text: validation.error, type: "error" });
      return;
    }
    const { origin } = validation;

    setMessage(null);
    setIsSubmitting(true);
    try {
      if (await browser.permissions.contains({ origins: [origin] })) {
        setMessage({ text: `Permission for ${origin} is already granted.`, type: "info" });
        await loadPermissions();
        return;
      }
      // Must run in the click's user-gesture context — this page is a real
      // extension page, so request directly instead of via the background.
      const granted = await browser.permissions.request({ origins: [origin] });
      setMessage(
        granted
          ? { text: `Permission granted for ${origin}`, type: "success" }
          : { text: `Permission denied for ${origin}`, type: "error" },
      );
      if (granted) await loadPermissions();
    } catch (error) {
      console.error("[PaperDebugger] Error requesting permission", error);
      const text = error instanceof Error ? error.message : "Error requesting permission";
      setMessage({ text: `Error: ${text}`, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }, [permissionUrl, loadPermissions]);

  return (
    <div className="pd-settings">
      <div className="pd-card">
        <h1 className="pd-title">PaperDebugger Settings</h1>

        <div className="pd-section">
          <div className="pd-section-title">Host Permissions</div>
          <p className="pd-section-desc">Add your self-hosted Overleaf domain so PaperDebugger can interact with it.</p>

          <label className="pd-label" htmlFor="pd-url">
            Website URL:
          </label>
          <input
            id="pd-url"
            className="pd-input"
            placeholder="https://www.example.com/ or https://*.example.com/*"
            value={permissionUrl}
            onChange={(e) => setPermissionUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isSubmitting) submit();
            }}
          />
          <p className="pd-hint">
            Example: <code>*://*.overleaf.com/*</code>
          </p>
          <p className="pd-hint">
            Example: <code>*://sharelatex.gwdg.de/*</code>
          </p>

          <div className="pd-actions">
            <button className="pd-button" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "Requesting..." : "Request Permission"}
            </button>
          </div>

          {message && <div className={`pd-message pd-message-${message.type}`}>{message.text}</div>}

          <div className="pd-list">
            {isLoading ? (
              <p className="pd-muted">Loading permissions...</p>
            ) : origins.length === 0 ? (
              <>
                <p className="pd-muted">No permissions granted yet.</p>
                <p className="pd-muted">Please request permission for the website you want to use.</p>
              </>
            ) : (
              origins.map((origin) => (
                <div key={origin} className="pd-list-item">
                  <div>
                    <div className="pd-list-item-label">Host Permission</div>
                    <div className="pd-list-item-origin">{origin}</div>
                  </div>
                  <div className="pd-badge">Granted</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
