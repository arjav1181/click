import * as React from "react";
import { cn } from "./utils";

export interface Step {
  id: string;
  label: string;
  state?: "pending" | "active" | "done" | "error";
}

export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((step, index) => {
        const state = step.state ?? "pending";
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-pill border text-xs font-semibold",
                state === "done" && "border-accent bg-accent text-on-accent",
                state === "active" && "border-accent bg-accent-soft text-accent",
                state === "error" && "border-danger bg-danger-soft text-danger",
                state === "pending" && "border-border bg-surface-2 text-text-muted",
              )}
            >
              {state === "done" ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                state === "active" ? "font-semibold text-text" : "text-text-muted",
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="h-px w-4 bg-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
