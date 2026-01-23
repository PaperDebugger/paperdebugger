import { VariableInput } from "./VariableInput";
import { useAuthStore } from "../stores/auth-store";
import { useCallback, useEffect, useState } from "react";
import { getCookies } from "../intermediate";
import { TooltipArea } from "./tooltip";
import { DevTools } from "../views/devtools";
import { useDevtoolStore } from "../stores/devtool-store";
import { storage } from "../libs/storage";

/**
 * Updates or creates the meta[name="ol-csrfToken"] tag in the document head
 */
const updateCsrfTokenMeta = (csrfToken: string) => {
  let metaTag = document.querySelector('meta[name="ol-csrfToken"]') as HTMLMetaElement | null;
  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.name = "ol-csrfToken";
    document.head.appendChild(metaTag);
  }
  metaTag.content = csrfToken;
};

const App = () => {
  const { token, refreshToken, setToken, setRefreshToken } = useAuthStore();
  const [projectId, setProjectId] = useState(storage.getItem("pd.projectId") ?? "");
  const [overleafSession, setOverleafSession] = useState(storage.getItem("pd.auth.overleafSession") ?? "");
  const [gclb, setGclb] = useState(storage.getItem("pd.auth.gclb") ?? "");
  const [csrfToken, setCsrfToken] = useState(storage.getItem("pd.auth.csrfToken") ?? "");
  const { showTool } = useDevtoolStore();
  
  useEffect(() => {
    getCookies(window.location.hostname).then((cookies) => {
      setOverleafSession(cookies.session ?? localStorage.getItem("pd.auth.overleafSession") ?? "");
      setGclb(cookies.gclb ?? localStorage.getItem("pd.auth.gclb") ?? "");
    });
    const savedCsrfToken = storage.getItem("pd.auth.csrfToken") ?? "";
    setCsrfToken(savedCsrfToken);
    // Create meta tag if csrfToken exists
    if (savedCsrfToken) {
      updateCsrfTokenMeta(savedCsrfToken);
    }
  }, []);

  const setProjectId_ = useCallback((projectId: string) => {
    localStorage.setItem("pd.projectId", projectId);
    setProjectId(projectId);
  }, []);

  const setOverleafSession_ = useCallback((overleafSession: string) => {
    localStorage.setItem("pd.auth.overleafSession", overleafSession);
    setOverleafSession(overleafSession);
  }, []);

  const setGclb_ = useCallback((gclb: string) => {
    localStorage.setItem("pd.auth.gclb", gclb);
    setGclb(gclb);
  }, []);

  const setCsrfToken_ = useCallback((csrfToken: string) => {
    storage.setItem("pd.auth.csrfToken", csrfToken);
    setCsrfToken(csrfToken);
    // Update meta tag in DOM
    updateCsrfTokenMeta(csrfToken);
  }, []);

  return (
    <main className="flex flex-row gap-2">
      <div className="flex flex-col gap-2 max-w-xl p-4 bg-slate-50 rounded-lg border-slate-200 border">
        <div className="flex flex-col gap-2">
          <VariableInput
            title="Project ID"
            description="Overleaf → URL → /projectId"
            value={projectId}
            setValue={setProjectId_}
          />
          <VariableInput
            title="Overleaf Session"
            description="Overleaf → Request Headers → Cookie → overleaf_session2"
            value={overleafSession}
            setValue={setOverleafSession_}
          />
          <VariableInput
            title="GCLB"
            description="Overleaf → Request Headers → Cookie → GCLB"
            value={gclb}
            setValue={setGclb_}
          />
          <VariableInput
            title="Token"
            description="Overleaf → Local Storage → https://www.overleaf.com → pd.auth.token"
            value={token}
            setValue={setToken}
          />
          <VariableInput
            title="Refresh Token"
            description="Overleaf → Local Storage → https://www.overleaf.com → pd.auth.refreshToken"
            value={refreshToken}
            setValue={setRefreshToken}
          />
          <VariableInput
            title="CSRF Token"
            description="Overleaf → Request Headers → X-CSRF-Token (also creates meta[name='ol-csrfToken'])"
            value={csrfToken}
            setValue={setCsrfToken_}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <TooltipArea>
          <div className="whitespace-pre-wrap break-all max-w-full font-mono text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="whitespace-pre-wrap break-all max-w-full font-mono text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
            {JSON.stringify(
              {
                projectId,
                overleafSession,
                gclb,
                token,
                refreshToken,
              },
              null,
              2,
            )}
          </div>
        </TooltipArea>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
      {import.meta.env.DEV && showTool && <DevTools />}
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
      {import.meta.env.DEV && showTool && <DevTools />}
      </div>
    </main>
  );
};

export default App;
