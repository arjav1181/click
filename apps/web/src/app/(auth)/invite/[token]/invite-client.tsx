"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardHeader, Field, Input, Skeleton } from "@click/ui";
import { postJson } from "@/lib/client";

interface Invitation {
  email: string;
  role: string;
  orgName: string;
  expiresAt: string;
}

export function InviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/invites/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Invitation not found.");
        setInvitation(payload.invitation as Invitation);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Invitation not found."));
  }, [token]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await postJson("/api/v1/auth/invite/accept", {
        token,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(password ? { password } : {}),
      });
      router.replace("/app");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join the workspace.");
    } finally {
      setLoading(false);
    }
  };

  if (!invitation && !error) {
    return (
      <Card className="p-6">
        <CardHeader title="Checking your invitation" description="One moment." />
        <div className="mt-6 grid gap-3" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  if (error && !invitation) {
    return (
      <Card className="p-6">
        <CardHeader title="Invitation unavailable" description={error} />
        <p className="mt-4 text-sm">
          <Link href="/login" className="text-accent hover:underline">
            Sign in instead
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CardHeader
        title={`Join ${invitation?.orgName}`}
        description={`You were invited as ${invitation?.role} at ${invitation?.email}.`}
      />
      <form onSubmit={onSubmit} className="mt-4 grid gap-4">
        <Field label="Your name" htmlFor="name" hint="Only needed if this is your first time here.">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ava Chen" />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="Use your existing password, or choose one with at least 10 characters, a letter and a number."
        >
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Accept invitation
        </Button>
      </form>
    </Card>
  );
}
