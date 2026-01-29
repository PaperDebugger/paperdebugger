/**
 * Stream Request Builder
 *
 * Provides a pure, testable function for building streaming request objects.
 * This extracts the request-building logic from useSendMessageStream hook,
 * making it easier to test and reducing hook complexity.
 */

import {
    ConversationType,
    CreateConversationMessageStreamRequest,
  } from "../pkg/gen/apiclient/chat/v2/chat_pb";
  import { PlainMessage } from "../query/types";
  
  // ============================================================================
  // Types
  // ============================================================================
  
  /**
   * Parameters required to build a stream request.
   */
  export interface StreamRequestParams {
    /** User message content */
    message: string;
    /** Selected text from the document */
    selectedText: string;
    /** Project/document ID */
    projectId: string;
    /** Current conversation ID */
    conversationId: string;
    /** Model slug for the conversation */
    modelSlug: string;
    /** Surrounding text context */
    surroundingText?: string;
    /** Conversation mode (debug or default) */
    conversationMode: "debug" | "default";
    /** Parent message ID for message editing/branching */
  }
  
  // ============================================================================
  // Request Builder
  // ============================================================================
  
  /**
   * Build a stream request from the given parameters.
   *
   * This is a pure function that creates the request object needed for
   * the streaming API call. Extracting this logic makes it:
   * - Easy to test in isolation
   * - Reusable across different contexts
   * - Clear what data is needed to make a request
   *
   * @param params - The parameters for building the request
   * @returns The request object ready for the API call
   *
   * @example
   * ```ts
   * const request = buildStreamRequest({
   *   message: "Hello",
   *   selectedText: "",
   *   projectId: "123",
   *   conversationId: "456",
   *   modelSlug: "gpt-4",
   *   conversationMode: "default",
   * });
   * await createConversationMessageStream(request, onMessage);
   * ```
   */
  export function buildStreamRequest(
    params: StreamRequestParams
  ): PlainMessage<CreateConversationMessageStreamRequest> {
    return {
      projectId: params.projectId,
      conversationId: params.conversationId,
      modelSlug: params.modelSlug,
      userMessage: params.message,
      userSelectedText: params.selectedText,
      surrounding: params.surroundingText ?? undefined,
      conversationType:
        params.conversationMode === "debug"
          ? ConversationType.DEBUG
          : ConversationType.UNSPECIFIED,
    };
  }
  
  /**
   * Validate stream request parameters.
   *
   * @param params - The parameters to validate
   * @returns An object with `valid` boolean and optional `error` message
   */
  export function validateStreamRequestParams(
    params: Partial<StreamRequestParams>
  ): { valid: boolean; error?: string } {
    if (!params.message || !params.message.trim()) {
      return { valid: false, error: "Message cannot be empty" };
    }
  
    if (!params.projectId) {
      return { valid: false, error: "Project ID is required" };
    }
  
    if (!params.conversationId) {
      return { valid: false, error: "Conversation ID is required" };
    }
  
    if (!params.modelSlug) {
      return { valid: false, error: "Model slug is required" };
    }
  
    return { valid: true };
  }
  