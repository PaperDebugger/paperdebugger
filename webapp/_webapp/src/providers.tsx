import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { UNSAFE_PortalProvider } from "@react-aria/overlays";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SocketStoreProvider } from "./stores/socket-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // Keep heroui/react-aria portals (modals/tooltips/popovers) inside our scoped
  // root when injected into Overleaf; getContainer returns null on standalone
  // pages (settings/popup), where react-aria falls back to document.body.
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <UNSAFE_PortalProvider getContainer={() => document.getElementById("pd-portal")}>
          <ToastProvider
            placement="bottom-left"
            toastProps={{
              variant: "bordered",
              timeout: 2000,
              shouldShowTimeoutProgress: true,
            }}
          />
          <SocketStoreProvider />
          {children}
        </UNSAFE_PortalProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
