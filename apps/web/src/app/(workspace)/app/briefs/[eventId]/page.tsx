"use client";

import { useCallback, useEffect, useState } from "react";
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
import { fetchBrief, type BriefData } from "@/lib/api";
import Link from "next/link";

export default function BriefPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const toast = useToast();
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchBrief(eventId);
    if (result.data) setBrief(result.data.brief);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Pre-meeting brief</h2>
        <p className="text-sm text-text-muted">
          Prep from your past meetings before you join.
        </p>
      </div>

      {error ? (
        <Card>
          <EmptyState
            title="No brief available"
            description={error ?? "This event does not exist or has no context."}
          />
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : brief ? (
        <Card>
          <CardHeader
            title={brief.eventTitle ?? "Upcoming meeting"}
            description={brief.eventStartsAt ? new Date(brief.eventStartsAt).toLocaleString() : undefined}
          />
          <div className="grid gap-3 p-4">
            {brief.bullets.map((bullet, index) => (
              <div key={index} className="flex gap-3">
                <span className="mt-1 size-1.5 shrink-0 rounded-pill bg-accent" />
                <div className="min-w-0">
                  <p className="text-sm text-text">{bullet.text}</p>
                  {bullet.sourceMeetingId ? (
                    <Link
                      href={`/app/meetings/${bullet.sourceMeetingId}`}
                      className="text-xs text-text-muted hover:text-text"
                    >
                      Source: {bullet.sourceTitle}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
