"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Field, Card, CardHeader } from "@click/ui";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name || !email || password.length < 8) {
      setError("Name, email and an 8+ character password are required.");
      return;
    }
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setLoading(false);
    router.push("/onboarding");
  };

  return (
    <Card className="p-6">
      <CardHeader title="Create your workspace" description="Self-hosted. Your data stays on your infrastructure." />
      <form onSubmit={onSubmit} className="mt-4 grid gap-4">
        <Field label="Your name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ava Chen" />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
        <p className="text-center text-xs text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}
