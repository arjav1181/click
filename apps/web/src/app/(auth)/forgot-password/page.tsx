"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardHeader, Field, Input } from "@click/ui";
import { postJson } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await postJson<{ devLink?: string }>("/api/v1/auth/forgot-password", { email });
      setSent(true);
      if (result.devLink) setDevLink(result.devLink);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader
        title="Reset your password"
        description={sent ? "If that email has an account, a reset link is on its way." : "We will email you a single-use link."}
      />
      {sent ? (
        <div className="mt-4 grid gap-3 text-sm text-text-muted">
          <p>The link expires in 60 minutes. Check your spam folder if it does not arrive.</p>
          {devLink ? (
            <a href={devLink} className="break-all text-xs text-accent hover:underline">
              Development only: open the reset link
            </a>
          ) : null}
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-xs text-text-muted">
            <Link href="/login" className="hover:text-accent">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </Card>
  );
}
