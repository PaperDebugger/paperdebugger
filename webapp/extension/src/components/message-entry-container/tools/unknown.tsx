import { cn } from "@heroui/react";

type UnknownToolCardProps = {
  functionName: string;
  message: string;
  animated: boolean;
};

export const UnknownToolCard = ({ functionName, message, animated }: UnknownToolCardProps) => {
  return (
    <div className={cn("tool-card", { animated: animated })}>
      <h3 className="text-xs font-semibold font-sans text-primary-700 uppercase tracking-wider mb-1">
        Unknown Tool "{functionName}"
      </h3>
      <span className="text-xs text-primary-600">{message}</span>
    </div>
  );
};
