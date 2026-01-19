/**
 * Storage Adapter Implementations
 *
 * Browser-specific storage implementations for the webapp.
 * - LocalStorageAdapter: Uses browser localStorage
 * - MemoryStorageAdapter: In-memory fallback when localStorage is unavailable
 */

import type { StorageAdapter } from "./types";

/**
 * LocalStorage adapter for browser environments
 */
export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      // eslint-disable-next-line no-console
      console.warn("[Storage] localStorage.getItem failed for key:", key);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[Storage] localStorage.setItem failed for key:", key, e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[Storage] localStorage.removeItem failed for key:", key, e);
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.warn("[Storage] localStorage not available, falling back to memory storage");
    return new MemoryStorageAdapter();
  }
}
