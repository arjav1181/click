import * as React from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-md border bg-surface px-3 text-base text-text",
        "placeholder:text-text-muted/70",
        "border-border-input hover:border-text-muted focus:border-focus focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted",
        invalid && "border-danger bg-danger-soft",
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-md border bg-surface px-3 py-2 text-base text-text",
        "placeholder:text-text-muted/70",
        "border-border-input hover:border-text-muted focus:border-focus focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted",
        invalid && "border-danger bg-danger-soft",
        className,
      )}
      {...props}
    />
  );
});

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
