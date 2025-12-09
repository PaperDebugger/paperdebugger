// import { generateId } from "./helpers";

// =============================================================================
// Interfaces - Authentication & User
// =============================================================================

export interface OverleafAuthentication {
  cookieOverleafSession2: string;
  cookieGCLB: string;
}

export interface OverleafUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

// =============================================================================
// Interfaces - Comments & Threads
// =============================================================================

export interface OverleafThreadMessage {
  content: string;
  id: string;
  timestamp: number;
  user: OverleafUser;
  user_id: string;
}

export interface OverleafThread {
  messages: OverleafThreadMessage[];
  resolved: boolean;
  resolved_at: string;
  resolved_by_user: OverleafUser;
  resolved_by_user_id: string;
}

// =============================================================================
// Interfaces - Project Structure
// =============================================================================

export interface OverleafProject {
  _id: string;
  name: string; // Project Name
  rootDoc_id: string; // Root document ID
  rootFolder: OverleafFolder[];
  publicAccessLevel: string; // default: private
  dropboxEnabled: boolean;
  compiler: string; // default: pdflatex
  description: string;
  spellcheckLanguage: string; // default: en_US
  deletedByExternalDataSource: boolean;
  deletedDocs: unknown[];
  members: unknown[];
  invites: unknown[];
  imageName: string; // default: texlive-full:2024.1
  owner: {
    _id: string;
    first_name: string;
    last_name: string;
    email: string;
    privileges: string; // owner
    signUpDate: string;
  };
  features: {
    // updated by March 5, 2025
    referencesSearch: boolean;
    zotero: boolean;
    mendeley: boolean;
    trackChanges: boolean;
    references: boolean;
    compileGroup: string; // default: priority
    compileTimeout: 240;
    gitBridge: boolean;
    github: boolean;
    dropbox: boolean;
    versioning: boolean;
    collaborators: -1;
    symbolPalette: boolean;
    papers: boolean;
    aiErrorAssistant: false;
    templates: false;
    trackChangesVisible: boolean;
  };
  trackChangesState: boolean;
}

export interface OverleafDoc {
  _id: string;
  name: string;
}

export interface OverleafFileRef {
  _id: string;
  name: string;
  created: string;
  hash: string;
}

export interface OverleafFolder {
  _id: string;
  name: string;
  folders: OverleafFolder[];
  fileRefs: OverleafFileRef[];
  docs: OverleafDoc[];
}

export interface OverleafJoinProjectResponse {
  permissionLevel: string; // e.g., owner
  project: OverleafProject;
  protocolVersion: number; // e.g., 2
  publicId: string; // unknown the purpose
}

export interface OverleafSocketResponse {
  name: string;
  args: unknown[];
}

export interface OverleafSocketRequest {
  name: string;
  args: unknown[];
}

export interface RequestResponse {
  // can be any type of request
  request: { name: string; args: unknown[] };
  // can be any type of response
  response: object | null;
  callback?: (response: object) => void;
}

export interface OverleafVersionedDoc {
  path: string;
  version: number;
  lines: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Retrieves all comment threads for a project
 *
 * @param auth - Overleaf authentication details
 * @param projectId - ID of the project
 * @returns Map of thread IDs to thread data
 */
// @ts-expect-error - this is a private function
// eslint-disable-next-line
async function opGetAllThreads(
  auth: OverleafAuthentication,
  csrfToken: string,
  projectId: string,
): Promise<Map<string, OverleafThread>> {
  const currentDomain = window.location.hostname;
  const res = await fetch(`https://${currentDomain}/project/${projectId}/threads`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Csrf-Token": csrfToken,
      Cookie: `overleaf_session2=${auth.cookieOverleafSession2}; GCLB=${auth.cookieGCLB}`,
    },
  });

  if (res.status !== 200) {
    throw new Error(`HTTP error when fetching threads: ${res.status}`);
  }

  const json: { [key: string]: OverleafThread } = await res.json();
  const ret = new Map<string, OverleafThread>();

  Object.entries(json).forEach(([threadId, threadData]) => {
    ret.set(threadId, threadData as OverleafThread);
  });

  return ret;
}

/**
 * Posts a comment to a thread
 *
 * @param threadId - ID of the thread
 * @param comment - Comment text to post
 * @param projectId - ID of the project
 * @param headers - HTTP headers for the request
 */
export async function postCommentToThread(
  threadId: string,
  comment: string,
  projectId: string,
  headers: HeadersInit,
): Promise<void> {
  const currentDomain = window.location.hostname;
  const threadUrl = `https://${currentDomain}/project/${projectId}/thread/${threadId}/messages`;
  // console.log("Posting comment to thread:", threadUrl, comment);

  if (!comment || comment.length === 0) {
    throw new Error("Comment is empty");
  }

  const response = await fetch(threadUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ content: comment }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
}

/**
 * Establishes WebSocket connection to Overleaf
 *
 * @param projectId - ID of the project
 * @param overleafAuth - Authentication details
 * @returns WebSocket connection
 */
export async function wsConnect(
  projectId: string,
  overleafAuth: OverleafAuthentication,
  csrfToken: string,
): Promise<WebSocket> {
  // if (import.meta.env.DEV) {
  //   throw new Error("Development mode is not supported for wsConnect");
  // }
  const currentDomain = window.location.hostname;
  const baseUrl = import.meta.env.DEV ? "http://localhost:3000" : "https://" + currentDomain;
  const res = await fetch(`${baseUrl}/socket.io/1/?projectId=${projectId}&t=${Date.now()}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Csrf-Token": csrfToken,
      Cookie: `overleaf_session2=${overleafAuth.cookieOverleafSession2}; GCLB=${overleafAuth.cookieGCLB}`,
    },
  });

  if (res.status !== 200) {
    throw new Error(`HTTP error when connecting ws: ${res.status}`);
  }

  const wsUrl = import.meta.env.DEV ? "ws://localhost:3000" : "wss://" + currentDomain;
  const data = await res.text();
  const sessionId = data.split(":")[0];

  // Set cookies for WebSocket connection
  document.cookie = `overleaf_session2=${overleafAuth.cookieOverleafSession2}; path=/; domain=${import.meta.env.DEV ? "localhost" : currentDomain}`;
  document.cookie = `GCLB=${overleafAuth.cookieGCLB}; path=/; domain=${import.meta.env.DEV ? "localhost" : currentDomain}`;

  return new WebSocket(`${wsUrl}/socket.io/1/websocket/${sessionId}?projectId=${projectId}`);
}
