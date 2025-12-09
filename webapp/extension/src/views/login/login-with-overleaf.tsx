import { useCallback } from "react";
import LogoOverleaf from "../../components/logo-overleaf";
import { getCookies } from "../../intermediate";
import { loginByOverleaf } from "../../query/api";
import { useAuthStore } from "../../stores/auth-store";
import { useSettingStore } from "../../stores/setting-store";
import { usePromptLibraryStore } from "../../stores/prompt-library-store";

interface LoginWithOverleafProps {
  isLoginLoading: boolean;
  setIsLoginLoading: (loading: boolean) => void;
  setErrorMessage: (message: string) => void;
  setLoginLoadingMessage: (message: string) => void;
}

export default function LoginWithOverleaf({
  isLoginLoading,
  setIsLoginLoading,
  setErrorMessage,
  setLoginLoadingMessage,
}: LoginWithOverleafProps) {
  const { loadSettings } = useSettingStore();
  const { loadPrompts } = usePromptLibraryStore();
  const { login, setToken, setRefreshToken } = useAuthStore();

  const onOverleafLogin = useCallback(async () => {
    try {
      setErrorMessage("");
      setLoginLoadingMessage("Please wait while we log you in...");
      setIsLoginLoading(true);

      const { session } = await getCookies(window.location.hostname);
      const resp = await loginByOverleaf({ overleafToken: session });

      setToken(resp.token);
      setRefreshToken(resp.refreshToken);
      await login();
      await loadSettings();
      await loadPrompts();
    } catch (e) {
      setErrorMessage("Login failed: " + (e as Error).message);
    } finally {
      setIsLoginLoading(false);
      setLoginLoadingMessage("Please continue in the opened window/tab");
    }
  }, [setToken, setRefreshToken, login, loadSettings, loadPrompts]);

  return (
    <div
      className="mt-[1rem] border border-primary-700 rounded-lg px-3 h-[32px] min-h-[32px] w-[196px] flex flex-row items-center bg-primary-700 text-white cursor-pointer"
      onClick={() => onOverleafLogin()}
      style={{
        cursor: isLoginLoading ? "wait" : "pointer",
      }}
    >
      <LogoOverleaf className="w-[14px] h-[14px]" />
      <div className="flex-1"></div>
      <span className="pd-continue-with-overleaf">Continue with Overleaf</span>
    </div>
  );
}
