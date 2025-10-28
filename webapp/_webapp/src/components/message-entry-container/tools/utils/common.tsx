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
    }
}

export const UNKNOWN_JSONRPC_RESULT: JsonRpcResult = {
    jsonrpc: "2.0",
    id: -1,
    error: {
        code: -1,
        message: "Unknown JSONRPC result",
    },
}

export const parseJsonRpcResult = (message: string): JsonRpcResult | undefined => {
    try {
        const json = JSON.parse(message);
        return json as JsonRpcResult;
    } catch (error) {
        return undefined;
    }
}