"use client";

import { useState } from "react";
import { Input, Button, Card, CardHeader, Badge, EmptyState, Skeleton } from "@click/ui";
import { searchMeetings } from "@/lib/api";
import type { SearchResult } from "@click/core";
import Link from "next/link";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const r = await searchMeetings(query);
    setResults(r);
    setSubmitted(query);
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h2 className="text-xl font-semibold text-text">Search</h2>
      <p className="mb-4 text-sm text-text-muted">Find anything across your meetings.</p>

      <Card className="mb-6 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcripts, notes, titles…"
            className="flex-1"
          />
          <Button type="submit" loading={loading}>
            Search
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" rounded="lg" />
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <Card>
          <EmptyState
            title="No results"
            description={`Nothing matched "${submitted}". Try different words.`}
          />
        </Card>
      ) : results.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-xs text-text-muted">
            {results.length} result{results.length === 1 ? "" : "s"} for "{submitted}"
          </p>
          {results.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/app/meetings/${r.meetingId}`}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    {r.meetingTitle}
                  </Link>
                  <p className="mt-1 text-sm text-text">{r.snippet}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {r.speakerName ? `${r.speakerName} · ` : ""}
                    {Math.floor(r.startMs / 60000)}:
                    {String(Math.floor((r.startMs % 60000) / 1000)).padStart(2, "0")}
                  </p>
                </div>
                <Badge tone="accent">segment</Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Search your archive"
            description="Type a question or keyword. Results link straight to the moment in the transcript."
          />
        </Card>
      )}
    </div>
  );
}
