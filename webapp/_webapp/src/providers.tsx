import { HeroUIProvider, ToastProvider } from "@heroui/react";
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

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
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
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
