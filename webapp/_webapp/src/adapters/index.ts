/**
 * Adapters module entry point
 *
 * Re-exports all adapter-related types, contexts, and implementations.
 *
 * Note: WordAdapter is NOT included here. It should be implemented and registered
 * by the host application (e.g., Office Add-in) using the __pdRegisterAdapter() global function.
 */

// Types
export type { DocumentAdapter, SelectionInfo, AdapterProps } from "./types";

// Context and hooks
export { AdapterProvider, useAdapter, useAdapterOptional } from "./context";

// Implementations
export { OverleafAdapter, getOverleafAdapter } from "./overleaf-adapter";

