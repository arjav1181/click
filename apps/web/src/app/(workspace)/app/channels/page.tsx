"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@click/ui";
import { createChannel, fetchChannels, type ChannelRow } from "@/lib/api";

export default function ChannelsPage() {
  const toast = useToast();
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchChannels().then((result) => {
      if (result.data) setChannels(result.data.channels);
      if (result.error) setError(result.error);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels.filter((channel) => {
      if (filter === "active" && channel.archivedAt) return false;
      if (filter === "archived" && !channel.archivedAt) return false;
      if (!needle) return true;
      return (
        channel.name.toLowerCase().includes(needle) ||
        (channel.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [channels, filter, query]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Give the channel a name.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createChannel({
      name: name.trim(),
      visibility,
      description: description.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    toast.push({ tone: "success", title: "Channel created" });
    setDialog(false);
    setName("");
    setDescription("");
    load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Channels</h2>
          <p className="text-sm text-text-muted">
            Spaces around a topic, an account or a team.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog(true)}>
          New channel
        </Button>
      </div>

      {error ? (
        <Banner
          tone="danger"
          title="Channels could not be loaded"
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="channel-search">
              Search channels
            </label>
            <Input
              id="channel-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or description…"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="channel-filter">
              Show
            </label>
            <Select
              id="channel-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as "active" | "archived" | "all")}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">Everything</option>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" rounded="lg" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Card>
          <EmptyState
            title="No channels yet"
            description="Channels gather the meetings, notes and people around one topic."
            action={
              <Button size="sm" onClick={() => setDialog(true)}>
                Create a channel
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No channels match"
            description="Try another search or show archived channels."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((channel) => (
            <Link key={channel.id} href={`/app/channels/${channel.id}`} className="block">
              <Card className="h-full p-4 transition-shadow hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text">{channel.name}</h3>
                  <div className="flex shrink-0 items-center gap-1">
                    {channel.archivedAt ? <Badge tone="neutral">Archived</Badge> : null}
                    <Badge tone={channel.visibility === "private" ? "warning" : "accent"}>
                      {channel.visibility === "private" ? "Private" : "Open"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {channel.description || "No description yet."}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                  <span>{channel.meetingCount} meetings</span>
                  <span>{channel.memberCount} members</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="New channel"
        description="Channels are visible to the whole workspace unless you make them private."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saving}>
              Create channel
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={submit}>
          <Field label="Channel name" htmlFor="channel-name">
            <Input
              id="channel-name"
              data-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Launch"
              invalid={Boolean(formError)}
            />
          </Field>
          <Field label="Visibility" htmlFor="channel-visibility">
            <Select
              id="channel-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "public" | "private")}
            >
              <option value="public">Open to the workspace</option>
              <option value="private">Private</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="channel-description">
            <Textarea
              id="channel-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this channel is about"
            />
          </Field>
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        </form>
      </Dialog>
    </div>
  );
}
