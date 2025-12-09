import { ReactNode } from "react";
import { StepItem } from "./StepItem";

export type Step = {
  number: number;
  content: ReactNode;
};

type StepsProps = {
  steps: Step[];
};

export const Steps = ({ steps }: StepsProps) => (
  <div className="steps">
    {steps.map((step) => (
      <StepItem key={step.number} number={step.number}>
        {step.content}
      </StepItem>
    ))}
  </div>
);

