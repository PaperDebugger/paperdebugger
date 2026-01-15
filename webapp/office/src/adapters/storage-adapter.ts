/**
 * Storage Adapter Implementations for Office Add-in
 *
 * Storage implementations:
 * - OfficeRoamingAdapter: For Word Add-in (uses localStorage, NOT roamingSettings which is Outlook-only)
 * - LocalStorageAdapter: Browser localStorage
 * - MemoryStorageAdapter: In-memory fallback
 */

/* global Office */

import type { StorageAdapter } from "./types";

// Re-export for convenience
export type { StorageAdapter } from "./types";

/**
 * Office Storage adapter for Word Add-in
 * 
 * Note: Office.context.roamingSettings is Outlook-only.
 * For Word Add-ins, we use localStorage with a fallback to in-memory storage.
 * localStorage in Office Add-in taskpane should persist across sessions.
 */
export class OfficeRoamingAdapter implements StorageAdapter {
  private _cache: Map<string, string> = new Map();
  private _useLocalStorage = false;
  private _initialized = false;

  constructor() {
    this._initStorage();
  }

  private _initStorage(): void {
    // Try to use localStorage
    try {
      const testKey = "__pd_storage_test__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      this._useLocalStorage = true;
      this._loadFromLocalStorage();
      console.log("[Storage] Using localStorage for persistence");
    } catch (e) {
      console.warn("[Storage] localStorage not available, using memory only", e);
      this._useLocalStorage = false;
      this._initialized = true;
    }
  }

  private _loadFromLocalStorage(): void {
    try {
      // Load all pd.* keys from localStorage into cache
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("pd.")) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            this._cache.set(key, value);
          }
        }
      }
      console.log("[Storage] Loaded from localStorage:", { 
        keys: Array.from(this._cache.keys()) 
      });
      this._initialized = true;
    } catch (e) {
      console.warn("[Storage] Failed to load from localStorage", e);
      this._initialized = true;
    }
  }

  getItem(key: string): string | null {
    // Always read from localStorage directly if available (for freshness)
    if (this._useLocalStorage) {
      try {
        const value = localStorage.getItem(key);
        console.log("[Storage] getItem from localStorage:", { key, hasValue: !!value });
        return value;
      } catch (e) {
        console.warn("[Storage] Failed to read from localStorage, using cache", e);
      }
    }
    const value = this._cache.get(key) ?? null;
    console.log("[Storage] getItem from cache:", { key, hasValue: !!value, cacheSize: this._cache.size });
    return value;
  }

  setItem(key: string, value: string): void {
    console.log("[Storage] setItem:", { key, valueLength: value?.length ?? 0 });
    this._cache.set(key, value);
    
    if (this._useLocalStorage) {
      try {
        localStorage.setItem(key, value);
        console.log("[Storage] Saved to localStorage");
      } catch (e) {
        console.warn("[Storage] Failed to save to localStorage", e);
      }
    }
  }

  removeItem(key: string): void {
    this._cache.delete(key);
    
    if (this._useLocalStorage) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("[Storage] Failed to remove from localStorage", e);
      }
    }
  }

  clear(): void {
    // Only clear pd.* keys
    const keysToRemove = Array.from(this._cache.keys());
    this._cache.clear();
    
    if (this._useLocalStorage) {
      try {
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.warn("[Storage] Failed to clear localStorage", e);
      }
    }
  }

  keys(): string[] {
    return Array.from(this._cache.keys());
  }

  /**
   * Check if the adapter has finished initializing
   */
  isInitialized(): boolean {
    return this._initialized;
  }
}

/**
 * LocalStorage adapter for browser environments (fallback)
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
 * Detect the current platform
 */
export function detectPlatform(): "office" | "browser" {
  // Check if running in Office Add-in environment with roamingSettings
  if (typeof Office !== "undefined" && Office.context?.roamingSettings !== undefined) {
    return "office";
  }
  return "browser";
}

/**
 * Create storage adapter based on current platform
 */
export function createStorageAdapter(platform?: "office" | "browser" | "memory"): StorageAdapter {
  const detectedPlatform = platform ?? detectPlatform();

  switch (detectedPlatform) {
    case "office":
      return new OfficeRoamingAdapter();
    case "memory":
      return new MemoryStorageAdapter();
    case "browser":
    default:
      // Check if localStorage is available
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
}
