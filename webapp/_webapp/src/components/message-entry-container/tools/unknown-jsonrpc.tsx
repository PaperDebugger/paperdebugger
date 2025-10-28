import { cn } from "@heroui/react";

type UnknownJsonRpcProps = {
  functionName: string;
  message: string;
  animated: boolean;
};

export const UnknownJsonRpc = ({ functionName, message, animated }: UnknownJsonRpcProps) => {
  return (
    <div className={cn("tool-card", { animated: animated })}>
      <h3 className="text-xs font-semibold font-sans text-primary-700 uppercase tracking-wider mb-1">
        Unknown JsonRPC "{functionName}"
      </h3>
      <span className="text-xs text-primary-600">{message}</span>
    </div>
  );
};
