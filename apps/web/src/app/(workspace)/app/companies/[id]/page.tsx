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
import { fetchCompany, type CompanyRow } from "@/lib/api";
import Link from "next/link";

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCompany(id).then((result) => {
      if (!active) return;
      if (result.data) setCompany(result.data.company);
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

  if (error || !company) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <EmptyState
            title="Company not found"
            description={error ?? "It may have been removed."}
            action={
              <Link href="/app/companies">
                <Button size="sm">Back to companies</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/app/companies" className="text-sm text-text-muted hover:text-text">
        ← Companies
      </Link>
      <Card className="mt-4">
        <CardHeader title={company.name} description={company.domain ?? undefined} />
        <div className="grid gap-2 p-4 text-sm">
          <p className="text-text-muted">{company.peopleCount} people</p>
          <p className="text-text-muted">{company.meetingCount} meeting{company.meetingCount === 1 ? "" : "s"}</p>
        </div>
      </Card>
    </div>
  );
}
