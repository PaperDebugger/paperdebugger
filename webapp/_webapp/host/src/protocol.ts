// Chrome native-messaging wire format: 4-byte little-endian length + UTF-8 JSON.
// Ported from ageaf/host/src/nativeMessaging/protocol.ts.
export type NativeMessage = Record<string, unknown>;

const MAX_FRAME_BYTES = 16 * 1024 * 1024;

export function encodeNativeMessage(message: NativeMessage): Buffer {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export function decodeNativeMessages(buffer: Buffer): { messages: NativeMessage[]; carry: Buffer } {
  const messages: NativeMessage[] = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = buffer.readUInt32LE(offset);
    if (length > MAX_FRAME_BYTES) {
      console.error("[pd-host] frame too large", length);
      return { messages, carry: Buffer.alloc(0) };
    }
    if (buffer.length - offset - 4 < length) break;
    const payload = buffer.subarray(offset + 4, offset + 4 + length).toString("utf8");
    try {
      messages.push(JSON.parse(payload) as NativeMessage);
    } catch (error) {
      console.error("[pd-host] malformed JSON frame", error);
    }
    offset += 4 + length;
  }
  return { messages, carry: buffer.subarray(offset) };
}
