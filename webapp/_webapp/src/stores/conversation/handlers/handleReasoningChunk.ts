// import { logError } from "../../../libs/logger";
// import { ReasoningChunk, MessageTypeAssistant } from "../../../pkg/gen/apiclient/chat/v2/chat_pb";
// import { StreamingMessage } from "../../streaming-message-store";
// import { MessageEntry, MessageEntryStatus } from "../types";

// export function handleReasoningChunk(
//   chunk: ReasoningChunk,
//   updateStreamingMessage: (updater: (prev: StreamingMessage) => StreamingMessage) => void,
// ) {
//   updateStreamingMessage((prevMessage) => {
//     const updatedParts = prevMessage.parts.map((part: MessageEntry) => {
//       const isTargetPart = part.messageId === chunk.messageId && part.assistant;

//       if (!isTargetPart) return part;

//       const currentReasoning = part.assistant!.reasoning ?? "";
//       const updatedAssistant: MessageTypeAssistant = {
//         ...part.assistant!,
//         reasoning: currentReasoning + chunk.delta,
//       };

//       if (part.status !== MessageEntryStatus.PREPARING) {
//         logError("Reasoning chunk received for non-preparing part, this is a critical error");
//       }

//       return {
//         ...part,
//         assistant: updatedAssistant,
//       };
//     });

//     return {
//       ...prevMessage,
//       parts: updatedParts,
//       sequence: prevMessage.sequence + 1,
//     };
//   });
// }
