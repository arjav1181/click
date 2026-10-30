"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  Button,
  Card,
  CardHeader,
  Skeleton,
  Textarea,
  useToast,
} from "@click/ui";
import { fetchBotNotice, updateBotNotice } from "@/lib/api";

export default function BotNoticePage() {
  const toast = useToast();
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchBotNotice();
    if (result.data) setNotice(result.data.notice);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const result = await updateBotNotice(notice);
    setSaving(false);
    if (result.error) {
      toast.push({ tone: "error", title: "Notice did not save", description: result.error });
      return;
    }
    if (result.data) setNotice(result.data.notice);
    toast.push({ tone: "success", title: "Bot notice saved" });
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">Bot chat notice</h2>
        <p className="text-sm text-text-muted">
          The message posted in the meeting chat when a bot joins, telling participants they are recorded.
        </p>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Notice could not be loaded"
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

      {loading ? (
        <Skeleton className="h-40" rounded="lg" />
      ) : (
        <Card>
          <CardHeader title="Notice message" description="Posted in the meeting chat at join time." />
          <div className="grid gap-4 p-4">
            <Textarea
              rows={4}
              value={notice}
              maxLength={2000}
              onChange={(event) => setNotice(event.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" loading={saving} onClick={() => void save()}>
                Save notice
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
