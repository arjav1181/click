"use client";

import * as React from "react";
import { cn } from "./utils";

type ToastTone = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const Context = React.createContext<{
  push: (toast: Omit<ToastItem, "id">) => void;
} | null>(null);

const barTone: Record<ToastTone, string> = {
  info: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const value = React.useMemo(() => ({ push }), [push]);

  return (
    <Context.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 grid w-[min(360px,calc(100vw-2rem))] gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-surface p-3 shadow-pop"
          >
            <span aria-hidden="true" className={cn("w-1 self-stretch rounded-pill", barTone[toast.tone])} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="ml-auto text-xs text-text-muted hover:text-text"
              onClick={() =>
                setToasts((current) => current.filter((item) => item.id !== toast.id))
              }
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export function useToast() {
  const context = React.useContext(Context);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
