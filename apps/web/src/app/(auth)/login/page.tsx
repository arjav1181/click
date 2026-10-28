"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Field, Card, CardHeader } from "@click/ui";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setLoading(false);
    router.push("/app");
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
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <Link href="/signup" className="hover:text-accent">
            Create account
          </Link>
          <Link href="/signup" className="hover:text-accent">
            Magic link
          </Link>
        </div>
      </form>
    </Card>
  );
}
