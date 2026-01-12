import { VariableInput } from "./VariableInput";
import { useAuthStore } from "../stores/auth-store";
import { useCallback, useEffect, useState } from "react";
import { getCookies } from "../intermediate";
import { TooltipArea } from "./tooltip";
import { storage } from "../libs/storage";

const App = () => {
  const { token, refreshToken, setToken, setRefreshToken } = useAuthStore();
  const [projectId, setProjectId] = useState(storage.getItem("pd.projectId") ?? "");
  const [overleafSession, setOverleafSession] = useState(storage.getItem("pd.auth.overleafSession") ?? "");
  const [gclb, setGclb] = useState(storage.getItem("pd.auth.gclb") ?? "");

  useEffect(() => {
    getCookies(window.location.hostname).then((cookies) => {
      setOverleafSession(cookies.session ?? storage.getItem("pd.auth.overleafSession") ?? "");
      setGclb(cookies.gclb ?? storage.getItem("pd.auth.gclb") ?? "");
    });
  }, []);

  const setProjectId_ = useCallback((projectId: string) => {
    storage.setItem("pd.projectId", projectId);
    setProjectId(projectId);
  }, []);

  const setOverleafSession_ = useCallback((overleafSession: string) => {
    storage.setItem("pd.auth.overleafSession", overleafSession);
    setOverleafSession(overleafSession);
  }, []);

  const setGclb_ = useCallback((gclb: string) => {
    storage.setItem("pd.auth.gclb", gclb);
    setGclb(gclb);
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
        </div>
      </div>
      <div className="flex flex-col gap-2 w-50%">
        <TooltipArea>
          <div className="whitespace-pre-wrap">
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
    </main>
  );
};

export default App;
