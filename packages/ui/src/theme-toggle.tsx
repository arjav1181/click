"use client";

import * as React from "react";
import { cn } from "./utils";

type Theme = "light" | "dark" | "system";

const options: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>("system");

  React.useEffect(() => {
    const stored = window.localStorage.getItem("click-theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    window.localStorage.setItem("click-theme", next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = next;
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex gap-1 rounded-md bg-surface-2 p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={theme === option.id}
          onClick={() => apply(option.id)}
          className={cn(
            "rounded-sm px-2 py-1 text-xs",
            theme === option.id
              ? "bg-surface font-semibold text-text shadow-card"
              : "text-text-muted hover:text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
