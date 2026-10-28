import * as React from "react";
import { cn } from "./utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export type CitationOrigin = "human" | "ai" | "transcript" | "document";

const citationTones: Record<CitationOrigin, string> = {
  human: "bg-surface-2 text-text",
  ai: "bg-accent-soft text-accent",
  transcript: "bg-surface-2 text-text-muted",
  document: "bg-surface-2 text-text-muted",
};

export function CitationChip({
  origin,
  label,
  className,
  onClick,
  title,
}: {
  origin: CitationOrigin;
  label: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const text = origin === "human" ? "you" : origin === "ai" ? "AI" : label;
  const content = (
    <>
      <span className="font-semibold">{text}</span>
      {origin === "transcript" || origin === "document" ? (
        <span className="mono">{label}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
          "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium transition-colors",
          citationTones[origin],
          "hover:brightness-95",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium",
        citationTones[origin],
        className,
      )}
    >
      {content}
    </span>
  );
}
