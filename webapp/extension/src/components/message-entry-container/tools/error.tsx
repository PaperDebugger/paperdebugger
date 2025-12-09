import { cn } from "@heroui/react";

type ErrorToolCardProps = {
  functionName: string;
  errorMessage: string;
  animated: boolean;
};

export const ErrorToolCard = ({ functionName, errorMessage, animated }: ErrorToolCardProps) => {
  return (
    <div className={cn("tool-card !border-red-500 noselect", { animated: animated })}>
      <h3 className="text-xs font-semibold font-sans text-red-700 uppercase tracking-wider mb-1">
        Error in Tool "{functionName}"
      </h3>
      <span className="text-xs text-red-600 canselect">{errorMessage}</span>
    </div>
  );
};
