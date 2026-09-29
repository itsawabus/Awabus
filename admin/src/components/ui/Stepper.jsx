import { Check } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// When onStepClick is given, each step is a button so the user can jump to it.
export default function Stepper({ steps, activeStep, onStepClick }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-3 overflow-x-auto pb-1">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < activeStep;
        const isActive = stepNum === activeStep;
        const content = (
          <>
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isDone && 'bg-brand-600 text-white',
                isActive && !isDone && 'bg-navy text-white dark:bg-brand-600',
                !isDone && !isActive && 'bg-slate-100 text-slate-400 dark:bg-navy dark:text-slate-500'
              )}
            >
              {isDone ? <Check className="h-4 w-4" /> : stepNum}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-sm font-medium',
                isActive || isDone ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <div key={label} className="flex items-center gap-2">
            {onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(stepNum)}
                aria-current={isActive ? 'step' : undefined}
                className="flex items-center gap-2 rounded-full py-0.5 pr-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-navy-light"
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center gap-2">{content}</div>
            )}
            {stepNum < steps.length && <span className="mx-1 h-px w-6 bg-slate-200 dark:bg-slate-700" />}
          </div>
        );
      })}
    </div>
  );
}
