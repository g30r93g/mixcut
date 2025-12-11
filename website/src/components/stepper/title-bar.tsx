import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';

const steps = [
  { title: 'User Details' },
  { title: 'Payment Info' },
  { title: 'Auth OTP' },
  { title: 'Preview Form' },
];

export default function Component() {
  return (
    <Stepper defaultValue={2} className="space-y-8">
      <StepperNav className="mb-15 gap-3.5">
        {steps.map((step, index) => {
          return (
            <StepperItem key={index} step={index + 1} className="relative flex-1 items-start">
              <StepperTrigger className="flex grow flex-col items-start justify-center gap-3.5">
                <StepperIndicator className="bg-border data-[state=active]:bg-primary h-1 w-full rounded-full"></StepperIndicator>
                <div className="flex flex-col items-start gap-1">
                  <StepperTitle className="group-data-[state=inactive]/step:text-muted-foreground text-start font-semibold">
                    {step.title}
                  </StepperTitle>
                </div>
              </StepperTrigger>
            </StepperItem>
          );
        })}
      </StepperNav>

      <StepperPanel className="text-sm">
        {steps.map((step, index) => (
          <StepperContent key={index} value={index + 1} className="flex items-center justify-center">
            Step {step.title} content
          </StepperContent>
        ))}
      </StepperPanel>
    </Stepper>
  );
}
