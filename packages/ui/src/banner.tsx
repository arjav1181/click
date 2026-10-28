import * as React from "react";
import { cn } from "./utils";

type Tone = "info" | "warning" | "danger" | "success" | "neutral";

const tones: Record<Tone, string> = {
  info: "border-border bg-surface-2 text-text",
  warning: "border-warning bg-warning-soft text-warning",
  danger: "border-danger bg-danger-soft text-danger",
  success: "border-success bg-success-soft text-success",
  neutral: "border-border bg-surface-2 text-text-muted",
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-text">{children}</div> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
