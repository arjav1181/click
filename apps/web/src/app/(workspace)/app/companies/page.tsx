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
import { fetchCompanies, type CompanyRow } from "@/lib/api";

export default function CompaniesPage() {
  const toast = useToast();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchCompanies(query || undefined);
    if (result.data) setCompanies(result.data.companies);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Companies</h2>
        <p className="text-sm text-text-muted">
          A directory of companies that show up across your meetings.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Companies could not be loaded"
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
          placeholder="Search companies…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24" rounded="lg" />
          <Skeleton className="h-24" rounded="lg" />
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState
            title="No companies yet"
            description="Companies appear here once meetings mention them."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-surface-2 text-sm font-semibold text-text-muted">
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{company.name}</p>
                  {company.domain ? <p className="truncate text-xs text-text-muted">{company.domain}</p> : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                <span>{company.peopleCount} people</span>
                <span>{company.meetingCount} meeting{company.meetingCount === 1 ? "" : "s"}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
