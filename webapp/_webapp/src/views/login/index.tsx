import { useCallback, useState } from "react";
import { Logo } from "../../components/logo";
import { useAuthStore } from "../../stores/auth-store";
import { useSettingStore } from "../../stores/setting-store";
import { loginByGoogle, loginByOverleaf } from "../../query/api";
import { getAppleAuthToken, getGoogleAuthToken } from "../../libs/oauth";
import { usePromptLibraryStore } from "../../stores/prompt-library-store";
import { logInfo } from "../../libs/logger";
import { Icon } from "@iconify/react/dist/iconify.js";
import LogoOverleaf from "../../components/logo-overleaf";
import { getCookies } from "../../intermediate";


export const Login = () => {
    const { loadSettings } = useSettingStore();
    const { loadPrompts } = usePromptLibraryStore();
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [loginLoadingMessage, setLoginLoadingMessage] = useState<string>("Please continue in the opened window/tab");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const { login, setToken, setRefreshToken } = useAuthStore();

    const onGoogleLogin = useCallback(async () => {
        try {
            setErrorMessage("");
            setIsLoginLoading(true);

            const token = await getGoogleAuthToken();
            if (!token) {
                setErrorMessage("Login failed: Google token not found");
                return;
            }
            const resp = await loginByGoogle({ googleToken: token });

            setToken(resp.token);
            setRefreshToken(resp.refreshToken);
            await login();
            await loadSettings();
            await loadPrompts();
        } catch (e) {
            setErrorMessage("Login failed: " + (e as Error).message);
        } finally {
            setIsLoginLoading(false);
        }
    }, [setIsLoginLoading, loadSettings, setErrorMessage, loadPrompts, login, setToken, setRefreshToken])

    // @ts-expect-error TODO: enable this when apple fixed the issue
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onAppleLogin = useCallback(async () => {
        try {
            setErrorMessage("");
            setIsLoginLoading(true);
            const token = await getAppleAuthToken();
            logInfo("apple token", token);
        } catch (e) {
            setErrorMessage("Login failed: " + (e as Error).message);
        } finally {
            setIsLoginLoading(false);
        }
    }, [])

    const onOverleafLogin = useCallback(async () => {
        try {
            setErrorMessage("");
            setLoginLoadingMessage("Please wait while we log you in...");
            setIsLoginLoading(true);

            const { session } = await getCookies();
            const resp = await loginByOverleaf({overleafToken: session});

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
    }, [setToken, setRefreshToken, login, loadSettings, loadPrompts])
    return (
        <div className="flex flex-col h-full w-full items-center justify-center bg-gray-50 noselect py-12">
            <Logo className="mb-4" />
            <div className="flex flex-col items-center justify-center">
                <p className="text-exo-2 text-2xl font-light mb-2">Welcome to</p>
                <div>
                    <span className="text-exo-2 text-2xl font-light">Paper</span>
                    <span className="text-exo-2 text-2xl font-bold">Debugger</span>
                </div>
            </div>
            <div className="flex-1"></div>
            <button className="gsi-material-button" disabled={isLoginLoading} onClick={onGoogleLogin} style={{
                cursor: isLoginLoading ? "wait" : "pointer"
            }}>
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: "block" }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                    </div>
                    <span className="gsi-material-button-contents">Continue with Google</span>
                    <span style={{ display: "none" }}>Continue with Google</span>
                </div>
            </button>
{/* 
            <div
                aria-disabled={true}
                color="primary"
                onClick={() => {
                    // if (!isLoginLoading) {
                    //     onAppleLogin();
                    // }
                }}
                style={{
                    // cursor: isLoginLoading ? "wait" : "pointer",
                    cursor: "not-allowed",
                    marginTop: "1rem"
                }}
            >
                <img className="noselect nodrag" style={{
                    width: "196px",
                    height: "32px",
                }} alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAxAAAACACAYAAACbd48jAAAAAXNSR0IArs4c6QAAIABJREFUeJzt3XtYVNXeB/AvdwQVJEG8T6YilkHeSKHEvKapmGZeKPE9Hc852qs8xzp1ygrrdM7bezxeei19n0rNvGVeULMDKoI31PACat4VRAm8oFxEBGTW+wfhC8zeM3vPDLNn4Pt5nvWUe89a+8eePZffrLXXckL96AAgCkAXAIEAWv1WAgE0r6djEhERERE1RoUAbvxW8n7770UAGwH8au2DOVmxrQ4AJgJ4BUBvK7ZLRERERETqCQCHAPwAYDOAbGs0ao0EIhLApwD6W6EtIiIiIiKqH6kAPgKw25JGLEkgngGwAFUJBBEREREROYbdAP4K4Kg5lZ3NqNMdVd0gx8DkgYiIiIjI0QwG8DOA7wF0VVtZbQ/EGwC+AOCu9kBERERERGR3ygHMBrBMaQUXhY9z/63ROBV1iIiIiIjIvrkAeAlVs6UmoOrGa6OU9EA8BuBHAM9aFBoREREREdmz3aiaVTXf2INMJRAhALYC6GiloIiIiIiIyH5lAXgRwDm5BxhLINwAJAMIt3JQRERERERkvw4AeAFAhdROY/czfAlgbH1EREREREREdqsDgABU3cZgQC6BiAXwfn1FREREREREdq03gBuQWCtCagjTMAA/wbw1IoiIiIiIqGGoADAGwL9rbqybQLgCyAbQ2kZBERERERGR/cpF1ZCmh9Ub6vYyRIPJAxERERERVWmNqhzhkZo9EK4AzgLobMuIiIiIiIjIrl0E0B2/9ULU7IGIBpMHIiIiIiKqrQtq9EJU90Cw94GIiIiIiORcBBAEQFT3QHQGkwciIiIiIpLWBVUJxKMhTFHaxUJERERERA4gCmACQUREREREykQBVfdAtAaQA+lF5YiIiIiIiABAAGjhjKrV5Zg8EBERERGRMU4AXnQGEKp1JERERERE5BCedQbgq3UURERERETkEAKdAQRqHQURERERETkEJhBERERERKRYoBOAAgA+WkdCRERERER2r9AJVdMxERERERERmeRs+iFERERERERVmEAQEREREZFirloH0NDodDp07NgRLVq0QHx8vNbhEBERERFZFXsgrCQyMhJbtmxBZmYmUlJSEBsbq3VIRERERERWxx4IC+l0OixcuBBRUVG1tqenp2sUERER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" />
            </div> */}

            <div className="mt-[1rem] border border-primary-700 rounded-lg px-3 h-[32px] min-h-[32px] w-[196px] flex flex-row items-center bg-primary-700 text-white cursor-pointer"
                onClick={() => onOverleafLogin()}
            >
                <LogoOverleaf className="w-[14px] h-[14px]" />
                <div className="flex-1"></div>
                <span className="pd-continue-with-overleaf">Continue with Overleaf</span>
            </div>

            {isLoginLoading && (
                <div className="text-sm text-gray-400 mt-4 flex items-center gap-2">
                    <Icon icon="tabler:loader" className="animate-spin" />
                    {loginLoadingMessage}
                </div>
            )}

            {errorMessage && (
                <div className="text-xs text-red-500 mt-2 text-center max-w-xs">
                    {errorMessage}
                </div>
            )}
            <div className="text-xs text-gray-500 mt-4 text-center max-w-xs">
                By login-in, you agree to PaperDebugger's <br /><a href="https://www.paperdebugger.com/terms/" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">terms of service</a> and its <a href="https://www.paperdebugger.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">privacy policy</a>.
            </div>
        </div>
    )
}