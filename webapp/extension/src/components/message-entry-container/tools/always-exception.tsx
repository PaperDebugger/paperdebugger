import { LoadingIndicator } from "../../loading-indicator";
import { cn } from "@heroui/react";
import { ErrorToolCard } from "./error";

type AlwaysExceptionCardProps = {
  message: string;
  preparing: boolean;
  animated: boolean;
};

const CardBody = ({ children }: { children: React.ReactNode }) => {
  return <div className="tool-card">{children}</div>;
};

export const AlwaysExceptionCard = ({ message, preparing, animated }: AlwaysExceptionCardProps) => {
  if (preparing) {
    return (
      <div className={cn("tool-card", { animated: animated })}>
        <LoadingIndicator text="Making some exceptions ..." estimatedSeconds={20} />
      </div>
    );
  }

  try {
    return (
      <CardBody>
        <div className="text-xs text-primary-600">{message}</div>
      </CardBody>
    );
  } catch (error) {
    return (
      <ErrorToolCard
        functionName="always_exception"
        errorMessage={`Failed to parse always exception: ${error}, message: ${message}`}
        animated={animated}
      />
    );
  }
};
