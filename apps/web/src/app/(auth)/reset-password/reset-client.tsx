"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardHeader, Field, Input } from "@click/ui";
import { postJson } from "@/lib/client";

export function ResetClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("This page needs a reset token. Request a new link.");
      return;
    }
    if (password.length < 10) {
      setError("Use at least 10 characters, with a letter and a number.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await postJson("/api/v1/auth/reset-password", { token, password });
      router.replace("/app");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reset the password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader title="Choose a new password" description="This signs you in and revokes every other session." />
      <form onSubmit={onSubmit} className="mt-4 grid gap-4">
        <Field label="New password" htmlFor="password" hint="At least 10 characters, with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Save password
        </Button>
        <p className="text-center text-xs text-text-muted">
          <Link href="/login" className="hover:text-accent">
            Back to sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}
