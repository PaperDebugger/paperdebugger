import { LoadingIndicator } from "../../loading-indicator";
import { cn } from "@heroui/react";

type GreetingCardProps = {
  message: string;
  preparing: boolean;
  animated: boolean;
};

export const GreetingCard = ({ message, preparing, animated }: GreetingCardProps) => {
  return (
    <div className={cn("tool-card noselect", { animated: animated })}>
      <h3 className="text-xs font-semibold font-sans text-primary-700 uppercase tracking-wider mb-1">🎉 Greeting!</h3>
      {preparing && <LoadingIndicator text={`Working on it...`} estimatedSeconds={5} />}
      {!preparing && <span className="text-xs text-primary-600">{message}</span>}
    </div>
  );
};
