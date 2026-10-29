"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  fetchChannel,
  fetchMeetingsInChannel,
  patchChannel,
  type ChannelMemberRow,
  type ChannelRow,
} from "@/lib/api";

interface ChannelMeeting {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number;
  source: string;
  status: string;
  ownerName: string;
  participantCount: number;
}

export default function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [channel, setChannel] = useState<ChannelRow | null>(null);
  const [members, setMembers] = useState<ChannelMemberRow[]>([]);
  const [meetings, setMeetings] = useState<ChannelMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchChannel(id), fetchMeetingsInChannel(id)]).then(
      ([channelResult, meetingResult]) => {
        if (channelResult.data) {
          setChannel(channelResult.data.channel);
          setMembers(channelResult.data.members);
          if (!channelResult.data.channel) setNotFound(true);
        }
        if (meetingResult.data) setMeetings(meetingResult.data.meetings);
        const failure = channelResult.error ?? meetingResult.error;
        if (failure) setError(failure);
        setLoading(false);
      },
    );
  };

  useEffect(load, [id]);

  const setArchived = async (archived: boolean) => {
    setBusy(true);
    const result = await patchChannel(id, { archived });
    setBusy(false);
    setArchiveDialog(false);
    if (result.error) {
      toast.push({ tone: "error", title: "The channel did not update", description: result.error });
      return;
    }
    if (result.data?.channel) setChannel(result.data.channel);
    toast.push({
      tone: "success",
      title: archived ? "Channel archived" : "Channel restored",
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/app/channels" className="mb-3 inline-block text-sm text-accent hover:underline">
        ← All channels
      </Link>

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : notFound ? (
        <Card>
          <EmptyState
            title="Channel not found"
            description="It may have been deleted, or you may not have access to it."
            action={
              <Link href="/app/channels">
                <Button size="sm">Back to channels</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-text">{channel?.name}</h2>
                <p className="mt-1 max-w-2xl text-sm text-text-muted">
                  {channel?.description || "No description yet."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={channel?.visibility === "private" ? "warning" : "accent"}>
                  {channel?.visibility === "private" ? "Private" : "Open"}
                </Badge>
                {channel?.archivedAt ? <Badge tone="neutral">Archived</Badge> : null}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setArchiveDialog(true)}
                  loading={busy}
                >
                  {channel?.archivedAt ? "Restore channel" : "Archive channel"}
                </Button>
              </div>
            </div>
          </Card>

          {error ? (
            <Banner
              tone="danger"
              title="Some data could not be loaded"
              action={
                <Button variant="secondary" size="sm" onClick={load}>
                  Retry
                </Button>
              }
            >
              {error}
            </Banner>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <section aria-label="Meetings in this channel">
              <h3 className="mb-2 text-sm font-semibold text-text">Meetings</h3>
              {meetings.length === 0 ? (
                <Card>
                  <EmptyState
                    title="No meetings in this channel yet"
                    description="Meetings show up here once they are filed under this channel."
                    action={
                      <Link href="/app/meetings">
                        <Button variant="secondary" size="sm">
                          Open meetings library
                        </Button>
                      </Link>
                    }
                  />
                </Card>
              ) : (
                <div className="grid gap-3">
                  {meetings.map((meeting) => (
                    <Card key={meeting.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/app/meetings/${meeting.id}`}
                            className="text-sm font-semibold text-text hover:text-accent hover:underline"
                          >
                            {meeting.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {meeting.startedAt
                              ? new Date(meeting.startedAt).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "No start time"}
                            {" · "}
                            Owned by {meeting.ownerName}
                          </p>
                        </div>
                        <Badge tone="neutral">{meeting.source}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <aside>
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-text">Members</h3>
                {members.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No members yet. Open channel members are workspace members.
                  </p>
                ) : (
                  <ul className="grid gap-2">
                    {members.map((member) => (
                      <li key={member.id} className="flex items-center gap-2">
                        <Avatar name={member.name} size="sm" />
                        <span className="min-w-0 truncate text-sm text-text">{member.name}</span>
                        {member.role ? <Badge tone="neutral">{member.role}</Badge> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </aside>
          </div>
        </>
      )}

      <Dialog
        open={archiveDialog}
        onClose={() => setArchiveDialog(false)}
        title={channel?.archivedAt ? "Restore this channel?" : "Archive this channel?"}
        description={
          channel?.archivedAt
            ? "The channel becomes visible again with its meetings and members."
            : "Archived channels are hidden from the default list. Nothing is deleted."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setArchived(Boolean(channel?.archivedAt))} loading={busy}>
              {channel?.archivedAt ? "Restore channel" : "Archive channel"}
            </Button>
          </>
        }
      />
    </div>
  );
}
