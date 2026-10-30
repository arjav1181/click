"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Skeleton,
  useToast,
} from "@click/ui";
import { fetchPeople, type PersonRow } from "@/lib/api";
import Link from "next/link";

export default function PeoplePage() {
  const toast = useToast();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPeople(query || undefined);
    if (result.data) setPeople(result.data.people);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">People</h2>
        <p className="text-sm text-text-muted">
          A directory built from the people who appear in your meetings.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="People could not be loaded"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      <Card className="mb-4 p-4">
        <Input
          value={query}
          placeholder="Search people…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" rounded="lg" />
          <Skeleton className="h-24" rounded="lg" />
        </div>
      ) : people.length === 0 ? (
        <Card>
          <EmptyState
            title="No people yet"
            description="People appear here once meetings have participants or transcripts."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((person) => (
            <Card key={person.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-pill bg-surface-2 text-sm font-semibold text-text-muted">
                  {person.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{person.name}</p>
                  {person.title ? <p className="truncate text-xs text-text-muted">{person.title}</p> : null}
                  {person.companyName ? (
                    <p className="truncate text-xs text-text-muted">{person.companyName}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                <span>{person.meetingCount} meeting{person.meetingCount === 1 ? "" : "s"}</span>
                {person.email ? <span className="truncate">{person.email}</span> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
