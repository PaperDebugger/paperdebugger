import { useState } from "react";
import { Logo } from "../../components/logo";
import { Icon } from "@iconify/react/dist/iconify.js";
import LoginWithGoogle from "./login-with-google";
import LoginWithOverleaf from "./login-with-overleaf";
import AdvancedSettings from "./advanced-settings";

export const Login = () => {
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginLoadingMessage, setLoginLoadingMessage] = useState<string>("Please continue in the opened window/tab");
  const [errorMessage, setErrorMessage] = useState<string>("");
  // toggle show endpoint settings
  const [showEndpointSettings, setShowEndpointSettings] = useState(false);

  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-gray-50 noselect py-12">
      {!showEndpointSettings && (
        <>
          <Logo className="mb-4" />
          <div className="flex flex-col items-center justify-center">
            <p className="text-exo-2 text-2xl font-light mb-2">Welcome to</p>
            <div>
              <span className="text-exo-2 text-2xl font-light">Paper</span>
              <span className="text-exo-2 text-2xl font-bold">Debugger</span>
            </div>
          </div>
        </>
      )}
      {showEndpointSettings && <AdvancedSettings />}
      <div className="flex-1"></div>

      <LoginWithGoogle
        isLoginLoading={isLoginLoading}
        setIsLoginLoading={setIsLoginLoading}
        setErrorMessage={setErrorMessage}
        setLoginLoadingMessage={setLoginLoadingMessage}
      />

      {/* <LoginWithApple
        isLoginLoading={isLoginLoading}
        setIsLoginLoading={setIsLoginLoading}
        setErrorMessage={setErrorMessage}
      /> */}

      <LoginWithOverleaf
        isLoginLoading={isLoginLoading}
        setIsLoginLoading={setIsLoginLoading}
        setErrorMessage={setErrorMessage}
        setLoginLoadingMessage={setLoginLoadingMessage}
      />

      {isLoginLoading && (
        <div className="text-sm text-gray-400 mt-4 flex items-center gap-2">
          <Icon icon="tabler:loader" className="animate-spin" />
          {loginLoadingMessage}
        </div>
      )}

      {errorMessage && <div className="text-xs text-red-500 mt-2 text-center max-w-xs">{errorMessage}</div>}
      <div className="text-xs text-gray-500 mt-4 text-center max-w-xs">
        By login-in, you agree to PaperDebugger's <br />
        <a
          href="https://www.paperdebugger.com/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 underline"
        >
          terms of service
        </a>{" "}
        and its{" "}
        <a
          href="https://www.paperdebugger.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 underline"
        >
          privacy policy
        </a>
        .
      </div>

      <div
        className="text-xs text-gray-500 mt-2 text-center max-w-xs hover:cursor-pointer hover:underline"
        onClick={() => {
          setShowEndpointSettings(!showEndpointSettings);
        }}
      >
        Advanced Options
      </div>
    </div>
  );
};
