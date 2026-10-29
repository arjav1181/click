"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Skeleton } from "@click/ui";
import { postJson } from "@/lib/client";

export function VerifyClient({ token }: { token: string }) {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState("error");
      setMessage("This link is missing its token.");
      return;
    }
    postJson("/api/v1/auth/verify-email", { token })
      .then(() => setState("done"))
      .catch((caught) => {
        setState("error");
        setMessage(caught instanceof Error ? caught.message : "Could not verify this link.");
      });
  }, [token]);

  return (
    <Card className="p-6">
      <CardHeader
        title={state === "done" ? "Email verified" : state === "error" ? "Could not verify" : "Verifying your email"}
        description={
          state === "done"
            ? "Your address is confirmed. You can close this tab."
            : state === "error"
              ? message
              : "One moment while we check this link."
        }
      />
      {state === "working" ? (
        <div className="mt-6 grid gap-3" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : (
        <p className="mt-4 text-sm">
          <Link href="/app" className="text-accent hover:underline">
            Go to your workspace
          </Link>
        </p>
      )}
    </Card>
  );
}
