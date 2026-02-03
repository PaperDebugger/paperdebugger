import { GeneralToolCard } from "./general";

type ErrorToolCardProps = {
  functionName: string;
  errorMessage: string;
  animated: boolean;
};

export const ErrorToolCard = ({ functionName, errorMessage, animated }: ErrorToolCardProps) => {
  return (
    <GeneralToolCard
      functionName={"Error in " + functionName}
      message={errorMessage}
      animated={animated}
      isLoading={animated}
    />
  );
};
