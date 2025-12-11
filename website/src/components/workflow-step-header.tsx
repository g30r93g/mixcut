'use client';

import { cn } from '@/lib/utils';
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';

export type WorkflowStep = {
  title: string;
  description?: string;
};

export type WorkflowStepHeaderProps = {
  steps: WorkflowStep[];
  currentStep: number;
  className?: string;
};

export function WorkflowStepHeader({ steps, currentStep, className }: WorkflowStepHeaderProps) {
  return (
    <div className={cn('w-full', className)}>
      <Stepper value={currentStep} className="space-y-4" orientation="horizontal">
        <StepperNav className="gap-4">
          {steps.map((step, index) => (
            <StepperItem key={step.title} step={index + 1}>
              <StepperTrigger
                className="flex w-full items-center gap-3 rounded-none border-none bg-transparent p-0 text-left"
                disabled
              >
                <StepperIndicator className="size-8 text-base font-semibold">{index + 1}</StepperIndicator>
                <div className="flex flex-col">
                  <StepperTitle className="text-foreground text-base font-semibold">
                    {step.title}
                  </StepperTitle>
                  {step.description ? (
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  ) : null}
                </div>
              </StepperTrigger>
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>
    </div>
  );
}
