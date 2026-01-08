/**
 * Adapters module entry point
 *
 * Re-exports all adapter-related types, contexts, and implementations.
 */

// Types
export type { DocumentAdapter, SelectionInfo, AdapterProps } from "./types";

// Context and hooks
export { AdapterProvider, useAdapter, useAdapterOptional } from "./context";

// Implementations
export { OverleafAdapter, getOverleafAdapter } from "./overleaf-adapter";
export { WordAdapter, createWordAdapter } from "./word-adapter";

