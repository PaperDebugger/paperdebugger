import { ReactNode } from "react";

type StepItemProps = {
  number: number;
  children: ReactNode;
};

export const StepItem = ({ number, children }: StepItemProps) => (
  <div className="step">
    <span className="step-number">{number}.</span>
    <p className="step-text">{children}</p>
  </div>
);
