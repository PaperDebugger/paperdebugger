import { useAuthStore } from "../stores/auth-store";
import { PaperDebugger } from "../paperdebugger";
import { Login } from "./login";

export const Body = () => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated() ? <PaperDebugger /> : <Login />;
};
