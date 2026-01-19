/**
 * Conversation Types (Backward Compatibility Layer)
 *
 * This file now re-exports types from the streaming module for backward compatibility.
 * For new code, prefer importing directly from '../streaming'.
 *
 * @deprecated Use types from '../streaming' instead
 */

export { MessageEntryStatus, type MessageEntry } from "../streaming/types";
