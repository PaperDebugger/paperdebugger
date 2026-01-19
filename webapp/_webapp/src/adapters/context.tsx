/**
 * Adapter Context
 *
 * Provides the DocumentAdapter to React components via context.
 * This allows UI components to access document operations without knowing the platform.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { DocumentAdapter } from "./types";

const AdapterContext = createContext<DocumentAdapter | null>(null);

interface AdapterProviderProps {
  adapter: DocumentAdapter;
  children: ReactNode;
}

export function AdapterProvider({ adapter, children }: AdapterProviderProps) {
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

/**
 * Hook to access the document adapter
 * @throws Error if used outside of AdapterProvider
 */
export function useAdapter(): DocumentAdapter {
  const adapter = useContext(AdapterContext);
  if (!adapter) {
    throw new Error("useAdapter must be used within an AdapterProvider");
  }
  return adapter;
}

/**
 * Hook to safely access the document adapter (returns null if not available)
 */
export function useAdapterOptional(): DocumentAdapter | null {
  return useContext(AdapterContext);
}

