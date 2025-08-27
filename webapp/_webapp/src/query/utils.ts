import { DescMessage, fromJson, JsonValue, JsonWriteOptions, toJson } from "@bufbuild/protobuf";
import { logError } from "../libs/logger";
import { useDevtoolStore } from "../stores/devtool-store";

export function getQueryParamsAsString<
  Desc extends DescMessage,
  Opts extends Partial<JsonWriteOptions> | undefined = undefined,
>(schema: Desc, message: JsonValue, options?: Opts): string {
  const json = toJson(schema, fromJson(schema, message), options) as object;
  const search = new URLSearchParams();
  Object.entries(json)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach((item) => {
      const [key, value] = item;
      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v) search.append(key, v);
        });
        return;
      }
      if (value) {
        search.append(key, value);
        return;
      }
    });
  return search.toString();
}

export const processStream = async <T>(
  stream: ReadableStream<Uint8Array>,
  schema: DescMessage,
  onMessage: (chunk: T) => void,
) => {
  const { slowStreamingMode } = useDevtoolStore.getState();
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf("\n")) !== -1) {
      const message = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 1);

      try {
        const parsedValue = JSON.parse(message);
        const messageData = parsedValue.result || parsedValue;
        onMessage(fromJson(schema, messageData) as T);
      } catch (err) {
        logError("Error parsing message from stream", err, message);
      }
    }

    if (import.meta.env.DEV && slowStreamingMode) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
};
