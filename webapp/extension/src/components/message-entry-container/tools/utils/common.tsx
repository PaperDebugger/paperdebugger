export type JsonRpcResult = {
  jsonrpc: string;
  id: number;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
};

export const UNKNOWN_JSONRPC_RESULT: JsonRpcResult = {
  jsonrpc: "2.0",
  id: -1,
  error: {
    code: -1,
    message: "Unknown JSONRPC result",
  },
};

const isValidJsonRpcResult = (obj: any): obj is JsonRpcResult => {
  // Check if obj is an object and not null
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // Check required properties
  if (typeof obj.jsonrpc !== "string" || typeof obj.id !== "number") {
    return false;
  }

  // Check that either result or error is present (but not both required)
  const hasResult = obj.result !== undefined;
  const hasError = obj.error !== undefined;

  // Validate result structure if present
  if (hasResult) {
    if (typeof obj.result !== "object" || obj.result === null) {
      return false;
    }
    if (obj.result.content !== undefined) {
      if (!Array.isArray(obj.result.content)) {
        return false;
      }
      // Validate each content item
      for (const item of obj.result.content) {
        if (
          typeof item !== "object" ||
          item === null ||
          typeof item.type !== "string" ||
          typeof item.text !== "string"
        ) {
          return false;
        }
      }
    }
  }

  // Validate error structure if present
  if (hasError) {
    if (
      typeof obj.error !== "object" ||
      obj.error === null ||
      typeof obj.error.code !== "number" ||
      typeof obj.error.message !== "string"
    ) {
      return false;
    }
  }

  return true;
};

export const parseJsonRpcResult = (message: string): JsonRpcResult | undefined => {
  try {
    const json = JSON.parse(message);

    // Validate the structure before casting
    if (isValidJsonRpcResult(json)) {
      return json;
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
};
