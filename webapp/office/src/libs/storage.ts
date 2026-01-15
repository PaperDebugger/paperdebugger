/**
 * Storage Abstraction Layer for Office Add-in
 *
 * Provides a unified interface for storage using the adapter pattern.
 * Adapter implementations are in src/adapters/storage-adapter.ts
 *
 * Uses Office.context.roamingSettings for persistent storage that follows the user.
 * Falls back to localStorage when Office API is not available.
 *
 * Usage:
 *   import { storage } from './storage';
 *   storage.setItem('key', 'value');
 *   const value = storage.getItem('key');
 */

// Re-export types and implementations from adapters
export type { StorageAdapter } from "../adapters/types";
export {
  OfficeRoamingAdapter,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  detectPlatform,
  createStorageAdapter,
} from "../adapters/storage-adapter";

import type { StorageAdapter } from "../adapters/types";
import { createStorageAdapter } from "../adapters/storage-adapter";

// Global storage instance - auto-detects platform
let _storageInstance: StorageAdapter | null = null;

/**
 * Get the global storage instance (singleton)
 * Auto-detects platform on first call
 */
export function getStorage(): StorageAdapter {
  if (!_storageInstance) {
    _storageInstance = createStorageAdapter();
  }
  return _storageInstance;
}

/**
 * Override the global storage instance
 * Useful for testing or when you need to explicitly set the adapter
 */
export function setStorage(adapter: StorageAdapter): void {
  _storageInstance = adapter;
}

/**
 * Reset the storage instance (useful for reinitializing after Office.onReady)
 */
export function resetStorage(): void {
  _storageInstance = null;
}

/**
 * Default export: the global storage instance
 * Can be used directly: storage.getItem('key')
 */
export const storage: StorageAdapter = new Proxy({} as StorageAdapter, {
  get(_, prop: keyof StorageAdapter) {
    const instance = getStorage();
    const value = instance[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

// ============================================================================
// Typed Storage Helpers (optional convenience layer)
// ============================================================================

/**
 * Type-safe storage wrapper with JSON serialization
 */
export class TypedStorage<T> {
  constructor(
    private key: string,
    private defaultValue: T,
    private adapter: StorageAdapter = getStorage()
  ) {}

  get(): T {
    const raw = this.adapter.getItem(this.key);
    if (raw === null) {
      return this.defaultValue;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return this.defaultValue;
    }
  }

  set(value: T): void {
    this.adapter.setItem(this.key, JSON.stringify(value));
  }

  remove(): void {
    this.adapter.removeItem(this.key);
  }

  reset(): void {
    this.set(this.defaultValue);
  }
}

/**
 * Create a typed storage helper
 *
 * @example
 * const tokenStorage = createTypedStorage('pd.auth.token', '');
 * tokenStorage.set('my-token');
 * const token = tokenStorage.get(); // string
 */
export function createTypedStorage<T>(key: string, defaultValue: T): TypedStorage<T> {
  return new TypedStorage(key, defaultValue);
}
