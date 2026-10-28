import * as React from "react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full appearance-none rounded-md border border-border-input bg-surface px-3 pr-8 text-sm text-text",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22none%22 stroke=%22%235b6470%22 stroke-width=%221.5%22><path d=%22M6 8l4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat",
        "focus:border-focus focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted",
        invalid && "border-danger bg-danger-soft",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
