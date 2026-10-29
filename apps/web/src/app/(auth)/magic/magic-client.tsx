"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, Skeleton } from "@click/ui";
import { postJson } from "@/lib/client";

export function MagicClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setError("This link is missing its token. Request a new sign-in link.");
      return;
    }
    postJson("/api/v1/auth/magic-link/consume", { token })
      .then(() => {
        router.replace("/app");
        router.refresh();
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not sign in."));
  }, [router, token]);

  return (
    <Card className="p-6">
      <CardHeader
        title={error ? "Link could not be used" : "Signing you in"}
        description={error ?? "One moment while we verify this link."}
      />
      {!error ? (
        <div className="mt-6 grid gap-3" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <p className="mt-4 text-sm">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      )}
    </Card>
  );
}
