/**
 * Adapters module entry point for Office Add-in
 *
 * Re-exports all adapter-related types and implementations.
 */

// Types
export type { DocumentAdapter, SelectionInfo, StorageAdapter } from "./types";

// Document Adapter Implementations
export { WordAdapter, createAndRegisterWordAdapter } from "./document-adapter";

// Storage Adapter Implementations
export {
  OfficeRoamingAdapter,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  detectPlatform,
  createStorageAdapter,
} from "./storage-adapter";