import { cn } from "@heroui/react";
import { JsonRpcResult } from "./utils/common";
import MarkdownComponent from "../../markdown";
import { LoadingIndicator } from "../../loading-indicator";
import { useState } from "react";

type JsonRpcProps = {
  functionName: string;
  jsonRpcResult: JsonRpcResult;
  preparing: boolean;
  animated: boolean;
};

export const JsonRpc = ({ functionName, jsonRpcResult, preparing, animated }: JsonRpcProps) => {

  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <div className="flex items-center justify-between">
          <h3 className="tool-card-title tool-card-jsonrpc">{"Calling " + functionName}</h3>
        </div>
        <LoadingIndicator text="Processing ..." estimatedSeconds={300} />
      </div>
    );
  }

  return (
    <div className={cn("tool-card noselect narrow", { animated: animated })}>
      <div className="flex items-center justify-between cursor-pointer">
        <h3 className="tool-card-title tool-card-jsonrpc">{functionName}</h3>
      </div>
    </div>
  );
};
