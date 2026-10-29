"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Field, Card, CardHeader } from "@click/ui";
import Link from "next/link";
import { postJson } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setLoading(true);
    try {
      await postJson("/api/v1/auth/login", { email, password });
      router.push("/app");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const onMagicLink = async () => {
    setError(null);
    setNotice(null);
    setDevLink(null);
    if (!email) {
      setError("Enter your email first, then request a link.");
      return;
    }
    setMagicLoading(true);
    try {
      const result = await postJson<{ devLink?: string }>("/api/v1/auth/magic-link", { email });
      setNotice("If that email has an account, a sign-in link is on its way.");
      if (result.devLink) setDevLink(result.devLink);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the link.");
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader title="Sign in to Click" description="Self-hosted meeting intelligence for your team." />
      <form onSubmit={onSubmit} className="mt-4 grid gap-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {notice ? <p className="text-sm text-text-muted">{notice}</p> : null}
        {devLink ? (
          <a href={devLink} className="break-all text-xs text-accent hover:underline">
            Development only: open the sign-in link
          </a>
        ) : null}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
        <button
          type="button"
          onClick={onMagicLink}
          disabled={magicLoading}
          className="text-center text-xs text-text-muted transition-colors hover:text-accent disabled:opacity-60"
        >
          {magicLoading ? "Sending…" : "Email me a sign-in link instead"}
        </button>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <Link href="/signup" className="hover:text-accent">
            Create account
          </Link>
          <Link href="/forgot-password" className="hover:text-accent">
            Forgot password?
          </Link>
        </div>
      </form>
    </Card>
  );
}
