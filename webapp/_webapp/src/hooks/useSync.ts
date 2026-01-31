/**
 * useSync - Platform-aware document synchronization hook
 *
 * This hook provides a unified sync interface that works across different platforms:
 * - Overleaf: Uses WebSocket to fetch all project files (existing logic)
 * - Word: Uses adapter.getFullText() to get document content directly
 *
 * Both platforms update the project snapshot to server DB via upsertProject().
 */

import { useCallback } from "react";
import { useAdapter } from "../adapters";
import { useSocketStore } from "../stores/socket-store";
import { useAuthStore } from "../stores/auth-store";
import { getCookies } from "../intermediate";
import { getProjectId } from "../libs/helpers";
import { upsertProject } from "../query/api";
import { UpsertProjectRequest, ProjectDoc } from "../pkg/gen/apiclient/project/v1/project_pb";
import { PlainMessage } from "../query/types";
import { logError, logInfo } from "../libs/logger";
import googleAnalytics from "../libs/google-analytics";

interface SyncOptions {
  onProgress?: (progress: number) => void;
}

interface SyncResult {
  success: boolean;
  error?: Error;
}

export function useSync() {
  const adapter = useAdapter();
  const { user } = useAuthStore();
  const { sync: overleafSync, syncing, syncingProgress } = useSocketStore();

  /**
   * Sync document content to server based on platform
   */
  const sync = useCallback(
    async (options?: SyncOptions): Promise<SyncResult> => {
      const projectId = adapter.getDocumentId?.() || getProjectId();
      const userId = user?.id || "";

      googleAnalytics.fireEvent(userId, "sync_documents", {
        projectId: projectId,
        platform: adapter.platform,
      });

      try {
        if (adapter.platform === "overleaf") {
          // Overleaf: Use existing socket-based sync
          const { session, gclb } = await getCookies(window.location.hostname);
          await overleafSync(
            userId,
            projectId,
            {
              cookieOverleafSession2: session,
              cookieGCLB: gclb,
            },
            "unused",
          );
          return { success: true };
        } else if (adapter.platform === "word") {
          // Word: Get full text directly and upload to server
          return await syncWordDocument(projectId, adapter, options);
        } else {
          // Browser or other platforms: Try to use adapter's getFullText
          return await syncGenericDocument(projectId, adapter, options);
        }
      } catch (error) {
        logError("Sync failed:", error);
        return { success: false, error: error as Error };
      }
    },
    [adapter, user?.id, overleafSync],
  );

  return {
    sync,
    syncing,
    syncingProgress,
    platform: adapter.platform,
  };
}

/**
 * Sync Word document content to server
 */
async function syncWordDocument(
  projectId: string,
  adapter: ReturnType<typeof useAdapter>,
  options?: SyncOptions,
): Promise<SyncResult> {
  logInfo(`[Word Sync] Starting sync for project: ${projectId}`);
  options?.onProgress?.(10);

  // Get full document content
  const fullText = await adapter.getFullText();
  options?.onProgress?.(50);

  // Create project snapshot with single document
  const projectSnapshot: PlainMessage<UpsertProjectRequest> = {
    projectId,
    name: "Word Document", // Word documents don't have a project name concept
    rootDocId: "main",
    docs: [
      {
        id: "main",
        version: Math.floor(Date.now() / 1000), // Use seconds timestamp (int32 safe)
        filepath: "document.docx",
        lines: fullText.split("\n"),
      } as PlainMessage<ProjectDoc>,
    ],
  };
  options?.onProgress?.(70);

  // Upload to server
  try {
    await upsertProject(projectSnapshot);
    options?.onProgress?.(100);
    logInfo("[Word Sync] Successfully synced document to server");
    return { success: true };
  } catch (error) {
    logError("[Word Sync] Failed to save project snapshot:", error);
    return { success: false, error: error as Error };
  }
}

/**
 * Generic document sync for other platforms
 */
async function syncGenericDocument(
  projectId: string,
  adapter: ReturnType<typeof useAdapter>,
  options?: SyncOptions,
): Promise<SyncResult> {
  logInfo(`[Generic Sync] Starting sync for project: ${projectId}`);
  options?.onProgress?.(10);

  try {
    const fullText = await adapter.getFullText();
    options?.onProgress?.(50);

    const projectSnapshot: PlainMessage<UpsertProjectRequest> = {
      projectId,
      name: "Document",
      rootDocId: "main",
      docs: [
        {
          id: "main",
          version: Math.floor(Date.now() / 1000),
          filepath: "document.txt",
          lines: fullText.split("\n"),
        } as PlainMessage<ProjectDoc>,
      ],
    };
    options?.onProgress?.(70);

    await upsertProject(projectSnapshot);
    options?.onProgress?.(100);
    logInfo("[Generic Sync] Successfully synced document to server");
    return { success: true };
  } catch (error) {
    logError("[Generic Sync] Failed to sync:", error);
    return { success: false, error: error as Error };
  }
}
