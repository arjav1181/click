"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  useToast,
} from "@click/ui";
import { fetchPerson, type PersonRow } from "@/lib/api";
import Link from "next/link";

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [person, setPerson] = useState<PersonRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPerson(id).then((result) => {
      if (!active) return;
      if (result.data) setPerson(result.data.person);
      if (result.error) setError(result.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-48" rounded="lg" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Person not found"
            description={error ?? "They may have been removed."}
            action={
              <Link href="/app/people">
                <Button size="sm">Back to people</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/app/people" className="text-sm text-text-muted hover:text-text">
        ← People
      </Link>
      <Card className="mt-4">
        <CardHeader title={person.name} description={person.title ?? undefined} />
        <div className="grid gap-2 p-4 text-sm">
          {person.email ? <p className="text-text-muted">Email: {person.email}</p> : null}
          {person.companyName ? <p className="text-text-muted">Company: {person.companyName}</p> : null}
          <p className="text-text-muted">{person.meetingCount} meeting{person.meetingCount === 1 ? "" : "s"}</p>
        </div>
      </Card>
    </div>
  );
}
