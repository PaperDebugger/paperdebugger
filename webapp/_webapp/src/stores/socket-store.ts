import { create } from "zustand";
import {
  OverleafAuthentication,
  OverleafFolder,
  OverleafJoinProjectResponse,
  OverleafSocketRequest,
  OverleafSocketResponse,
  OverleafVersionedDoc,
  postCommentToThread,
  RequestResponse,
  wsConnect,
} from "../libs/overleaf-socket";
import { generateId } from "../libs/helpers";
import { upsertProject } from "../query/api";
import { UpsertProjectRequest, ProjectDoc } from "../pkg/gen/apiclient/project/v1/project_pb";
import { PlainMessage } from "../query/types";
import { logError } from "../libs/logger";
import googleAnalytics from "../libs/google-analytics";

// Types
export interface SocketStore {
  // State
  projectName: string;
  rootDocId: string;
  content: string;
  docs: Map<string, OverleafVersionedDoc>; // fileId -> OverleafVersionedDoc

  syncing: boolean;
  syncingProgress: number; // 0-100

  auth: OverleafAuthentication | null;

  socketRef: WebSocket | null;
  socketJoined: boolean;
  socketMessageSeq: number;
  socketRequestResponse: Map<string, RequestResponse>;

  // Public API
  sync: (
    userId: string | undefined,
    projectId: string,
    overleafAuth: OverleafAuthentication,
    csrfToken: string,
  ) => Promise<Map<string, OverleafVersionedDoc>>;
  connectSocket: (projectId: string, overleafAuth: OverleafAuthentication, csrfToken: string) => Promise<void>;
  disconnectSocket: () => void;
  createSnapshot: (onProgress?: (progress: number) => void) => Promise<Map<string, OverleafVersionedDoc>>;
  addComment: (
    projectId: string,
    docId: string,
    docVersion: number,
    docSHA1: string,
    quotePosition: number,
    quoteText: string,
    comment: string,
    csrfToken: string,
  ) => Promise<string>;

  // Internal API - Document Management
  _updateDocById: (docId: string, options: { newPath?: string; newVersion?: number; newLines?: string[] }) => void;
  _overleafJoinDoc: (docId: string) => Promise<void>;
  _overleafLeaveDoc: (docId: string) => Promise<void>;
  _applyOtUpdate: (docId: string, hash: string, op: unknown, version: number) => Promise<object>;

  // Internal API - WebSocket Communication
  _sendRequest: (message: OverleafSocketRequest) => Promise<object>;
  _overleafUpdatePosition: (docId: string | null, position: number | undefined) => void;
  _overleafMessageHandler: (event: MessageEvent) => void;
  _overleafJsonMessageHandler: (data: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  _responseReceivedWithData: (data: string) => void;
  _responseReceivedWithoutData: (seq: number, data: OverleafSocketResponse) => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  // Initial State
  content: "",
  auth: null,
  projectName: "",
  rootDocId: "",
  docs: new Map<string, OverleafVersionedDoc>(),
  syncing: false,
  syncingProgress: 0,
  lastSync: null,

  socketRef: null,
  socketJoined: false,
  socketMessageSeq: 0,
  socketRequestResponse: new Map<string, RequestResponse>(),

  // Public API Methods
  /**
   * Sync with Overleaf project to get all documents and content
   */
  sync: async (
    userId: string | undefined,
    projectId: string,
    overleafAuth: OverleafAuthentication,
    csrfToken: string,
  ) => {
    const { connectSocket, disconnectSocket, createSnapshot } = get();
    set({ syncing: true });

    googleAnalytics.fireEvent(userId, "sync_documents", {
      projectId: projectId,
    });

    try {
      if (!overleafAuth.cookieOverleafSession2) {
        throw new Error("Invalid Overleaf session cookie");
      }

      // Disconnect any existing connection
      const { socketRef } = get();
      if (socketRef) {
        await disconnectSocket();
      }

      // Connect to the project
      await connectSocket(projectId, overleafAuth, csrfToken);

      // Create a snapshot of all documents
      const result = await createSnapshot((progress) => {
        set({ syncingProgress: Math.round(progress) });
      });

      // Update project snapshot to server DB
      const projectSnapshot: PlainMessage<UpsertProjectRequest> = {
        projectId,
        name: get().projectName,
        rootDocId: get().rootDocId,
        docs: Array.from(result.entries()).map(
          ([id, doc]): PlainMessage<ProjectDoc> => ({
            id,
            version: doc.version,
            filepath: doc.path,
            lines: doc.lines,
          }),
        ),
      };

      try {
        await upsertProject(projectSnapshot);
      } catch (e) {
        logError("failed to save project snapshot to MongoDB:", e);
      }

      return result;
    } catch (e) {
      logError("Error during sync:", e);
      throw e;
    } finally {
      disconnectSocket();
      set({ syncing: false, syncingProgress: 0 });
    }
  },

  /**
   * Connect to Overleaf WebSocket and fetch project content
   */
  connectSocket: async (projectId: string, overleafAuth: OverleafAuthentication, csrfToken: string) => {
    if (!overleafAuth.cookieOverleafSession2) {
      throw new Error("Invalid Overleaf session cookie");
    }

    const ws = await wsConnect(projectId, overleafAuth, csrfToken);

    // Configure WebSocket event handlers
    ws.onclose = () => {
      set({
        docs: new Map<string, OverleafVersionedDoc>(),
        socketRef: null,
        socketJoined: false,
      });
    };

    ws.onerror = (e: Event) => {
      logError("WebSocket error:", e);
    };

    ws.onopen = () => {};

    ws.onmessage = (event: MessageEvent) => {
      get()._overleafMessageHandler(event);
    };

    set({
      socketRef: ws,
      auth: overleafAuth,
    });

    // Wait for project join to complete
    const timeout = 10000; // 10 seconds timeout
    const startTime = Date.now();
    while (!get().socketJoined) {
      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout waiting for Overleaf project to join");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  },

  /**
   * Disconnect from Overleaf WebSocket and clean up state
   */
  disconnectSocket: () => {
    const { socketRef } = get();
    if (socketRef) socketRef.close();

    set({
      socketRef: null,
      socketJoined: false,
      socketMessageSeq: 0,
      socketRequestResponse: new Map<string, RequestResponse>(),
      docs: new Map<string, OverleafVersionedDoc>(),
    });
  },

  /**
   * Create a snapshot of all documents in the project
   */
  createSnapshot: async (onProgress?: (progress: number) => void) => {
    const { socketRef } = get();
    if (!socketRef) throw new Error("Socket is not initialized");

    let completedFiles = 0;
    const { docs } = get();
    const { _overleafJoinDoc, _overleafLeaveDoc } = get();

    for (const fileId of docs.keys()) {
      await _overleafJoinDoc(fileId);
      await _overleafLeaveDoc(fileId);

      completedFiles++;
      if (onProgress) onProgress((completedFiles / docs.size) * 100);
    }

    return docs;
  },

  /**
   * Add a comment to a document
   */
  addComment: async (
    projectId: string,
    docId: string,
    docVersion: number,
    docSHA1: string,
    quotePosition: number,
    quoteText: string,
    comment: string,
    csrfToken: string,
  ) => {
    const threadId = generateId();
    const { auth, _overleafJoinDoc, _overleafLeaveDoc } = get();
    if (!auth) throw new Error("No Overleaf authentication found");

    if (!projectId || !docId || !docSHA1 || !quoteText || !comment) {
      throw new Error("Invalid comment arguments, some are undefined.");
    }

    await _overleafJoinDoc(docId);

    // First post comment to thread via API
    await postCommentToThread(threadId, comment, projectId, {
      "X-Csrf-Token": csrfToken, // MUST HAVE
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: `overleaf_session2=${auth.cookieOverleafSession2}; GCLB=${auth.cookieGCLB}`,
    });

    // Then apply OT update to document
    const { _applyOtUpdate } = get();
    await _applyOtUpdate(docId, docSHA1, [{ c: quoteText, p: quotePosition, t: threadId }], docVersion);

    await _overleafLeaveDoc(docId);
    return threadId;
  },

  // Internal API - Document Management
  /**
   * Update a document by ID with new properties
   */
  _updateDocById: (docId, options) => {
    const { docs } = get();
    const doc = docs.get(docId);

    docs.set(docId, {
      path: options.newPath || doc?.path || "",
      version: options.newVersion || doc?.version || 0,
      lines: options.newLines || doc?.lines || [],
    });
  },

  /**
   * Join a document to load its content
   */
  _overleafJoinDoc: async (docId: string) => {
    const { _sendRequest } = get();
    await _sendRequest({
      name: "joinDoc",
      args: [docId, { encodeRanges: true }],
    });
  },

  /**
   * Leave a document when done with it
   */
  _overleafLeaveDoc: async (docId: string) => {
    const { _sendRequest } = get();
    await _sendRequest({
      name: "leaveDoc",
      args: [docId],
    });
  },

  /**
   * Apply an operational transformation update to a document
   */
  _applyOtUpdate: async (docId: string, hash: string, op: unknown, version: number) => {
    const { _sendRequest } = get();
    return _sendRequest({
      name: "applyOtUpdate",
      args: [docId, { doc: docId, hash: hash, op: op, v: version }],
    });
  },

  // Internal API - WebSocket Communication
  /**
   * Send a request to the WebSocket and await response
   */
  _sendRequest: async (message: OverleafSocketRequest) => {
    const { socketRef } = get();
    if (!socketRef) throw new Error("Socket not found or not ready");
    if (socketRef.readyState !== WebSocket.OPEN) throw new Error("Socket is not open");

    return new Promise((resolve, reject) => {
      const { socketMessageSeq, socketRequestResponse } = get();

      // Send message with sequence number
      socketRef.send(`5:${socketMessageSeq}+::` + JSON.stringify(message));
      set({ socketMessageSeq: socketMessageSeq + 1 });

      // Store callback to resolve promise when response arrives
      socketRequestResponse.set(`${socketMessageSeq}`, {
        request: message,
        response: null,
        callback: (response: object) => resolve(response),
      });

      // Set timeout to prevent hanging promises
      setTimeout(() => reject(new Error("Response timeout")), 5000);
    });
  },

  /**
   * Update position in the current document
   */
  _overleafUpdatePosition: (docId: string | null, position: number | undefined) => {
    const { _sendRequest } = get();
    return _sendRequest({
      name: "clientTracking.updatePosition",
      args: [{ doc_id: docId, position: position }],
    }).catch(() => ({}));
  },

  /**
   * Handle WebSocket messages
   */
  _overleafMessageHandler: (event: MessageEvent) => {
    const data = event.data;
    const { socketRef } = get();
    const {
      _overleafUpdatePosition,
      _responseReceivedWithData,
      _responseReceivedWithoutData,
      _overleafJsonMessageHandler,
    } = get();

    if (data.match(/^1::/)) {
      // Connection established
      _overleafUpdatePosition(null, undefined);
    } else if (data.match(/^2::/)) {
      // Heartbeat ping - reply with pong
      socketRef?.send("2::");
    } else if (data.match(/^5:::(.*)/)) {
      // Data message
      const dataMsg = JSON.parse(data.match(/^5:::(.*)/)[1]);
      _overleafJsonMessageHandler(dataMsg);
    } else if (data.match(/^6:::([^+]+)\+(.*)/)) {
      // Response with data
      _responseReceivedWithData(data);
    } else if (data.match(/^6:::\d+$/)) {
      // Response without data
      const seq = data.split(":")?.pop() || "unknown";
      _responseReceivedWithoutData(parseInt(seq), {
        name: "void return",
        args: [],
      });
    }
  },

  /**
   * Handle Overleaf data messages
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _overleafJsonMessageHandler: (data: any) => {
    const { _updateDocById } = get();

    if (data.name === "joinProjectResponse") {
      // Process project structure after joining
      const project = data.args[0] as OverleafJoinProjectResponse;
      const queue: OverleafFolder[] = project.project.rootFolder;

      // Process folder structure with BFS traversal
      while (queue.length > 0) {
        const folder = queue.pop();
        if (!folder) continue;

        // Process documents in current folder
        for (const doc of folder.docs) {
          const path = `${folder.name}/${doc.name}`.replace("rootFolder/", "");
          _updateDocById(doc._id, { newPath: path });
        }

        // Queue subfolders
        for (const subFolder of folder.folders) {
          queue.push({
            ...subFolder,
            name: `${folder.name}/${subFolder.name}`,
          });
        }
      }

      // Mark project as joined
      set({
        socketJoined: true,
        projectName: project.project.name,
        rootDocId: project.project.rootDoc_id,
      });
    } else if (data.name === "otUpdateApplied") {
      // Update document version after OT update
      const arg0 = data.args[0] as { doc: string; v: number };
      _updateDocById(arg0.doc, { newVersion: arg0.v });
    }
    // Other message types are ignored
  },

  /**
   * Process responses with data payload
   */
  _responseReceivedWithData: (data: string) => {
    if (!data.match(/^6:::\d+\+/)) return;

    // Parse response header and body
    const responseHeader = data.match(/^6:::\d+/) || [];
    const responseHeaderText = responseHeader[0]!;
    const seq = responseHeaderText.split(":")?.pop() || "unknown";
    const responseBodyText = data.slice(responseHeaderText.length + 1);
    const contentData = JSON.parse(responseBodyText);

    const { _responseReceivedWithoutData, _updateDocById } = get();
    _responseReceivedWithoutData(parseInt(seq), contentData);

    // Handle joinDoc response specifically
    const { socketRequestResponse } = get();
    if (socketRequestResponse.get(seq)?.request.name === "joinDoc") {
      const docId = (socketRequestResponse.get(seq)?.request.args[0] as string) || "";
      const nullArg = contentData[0]; // Should be null per Overleaf API. Check `overleaf/services/real-time/app/js/WebsocketController.js:354`

      if (nullArg !== null) {
        logError("joinDoc response[0] is not null:", nullArg);
        return;
      }

      const escapedLines = contentData[1] || ["CANT_FIND_DOC_CONTENT"];
      const version = contentData[2] || 0;
      // const ops = contentData[3];
      // const comments = contentData[4];

      // Decode the lines to UTF-8
      const decodedLines = escapedLines.map((line: string) => {
        try {
          const bytes = new Uint8Array([...line].map((c) => c.charCodeAt(0)));
          return new TextDecoder("utf-8").decode(bytes);
        } catch (e) {
          logError("Failed to decode line:", e);
          return line;
        }
      });

      _updateDocById(docId, {
        newVersion: version,
        newLines: decodedLines,
      });
    }
  },

  /**
   * Process WebSocket responses and resolve promises
   */
  _responseReceivedWithoutData: (seq: number, data: OverleafSocketResponse) => {
    const { socketRequestResponse } = get();
    const existingRequestResponse = socketRequestResponse.get(seq.toString());

    // Update request/response map
    socketRequestResponse.set(seq.toString(), {
      request: existingRequestResponse?.request || {
        name: "unknown",
        args: [],
      },
      response: data || null,
      callback: existingRequestResponse?.callback,
    });

    // Call the callback to resolve waiting promise
    if (existingRequestResponse?.callback) {
      existingRequestResponse.callback(data);
    }
  },
}));

export const SocketStoreProvider = () => {
  return null;
};
