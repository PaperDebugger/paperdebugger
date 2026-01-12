/**
 * Storage Abstraction Layer
 *
 * Provides a unified interface for storage using localStorage.
 *
 * Usage:
 *   import { storage } from './storage';
 *   storage.setItem('key', 'value');
 *   const value = storage.getItem('key');
 */

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  /** Get all keys in storage */
  keys(): string[];
}

/**
 * LocalStorage adapter for browser environments
 */
export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      console.warn("[Storage] localStorage.getItem failed for key:", key);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("[Storage] localStorage.setItem failed for key:", key, e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("[Storage] localStorage.removeItem failed for key:", key, e);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("[Storage] localStorage.clear failed", e);
    }
  }

  keys(): string[] {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  }
}

/**
 * In-memory storage adapter (fallback when no storage is available)
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private _store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this._store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this._store.set(key, value);
  }

  removeItem(key: string): void {
    this._store.delete(key);
  }

  clear(): void {
    this._store.clear();
  }

  keys(): string[] {
    return Array.from(this._store.keys());
  }
}

/**
 * Create storage adapter for browser environment
 */
export function createStorageAdapter(type?: "localStorage" | "memory"): StorageAdapter {
  if (type === "memory") {
    return new MemoryStorageAdapter();
  }

  // Default: try localStorage, fallback to memory
  try {
    const testKey = "__storage_test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return new LocalStorageAdapter();
  } catch {
    console.warn("[Storage] localStorage not available, falling back to memory storage");
    return new MemoryStorageAdapter();
  }
}

// Global storage instance
let _storageInstance: StorageAdapter | null = null;

/**
 * Get the global storage instance (singleton)
 */
export function getStorage(): StorageAdapter {
  if (!_storageInstance) {
    _storageInstance = createStorageAdapter();
  }
  return _storageInstance;
}

/**
 * Override the global storage instance
 * Useful for testing or when host environment provides a custom adapter
 */
export function setStorage(adapter: StorageAdapter): void {
  _storageInstance = adapter;
}

/**
 * Reset the storage instance
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
