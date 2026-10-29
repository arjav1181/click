"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
  useToast,
} from "@click/ui";
import {
  fetchFolders,
  fetchMeetingsInFolder,
  fetchSpaces,
  moveMeetingToFolder,
  type FolderRow,
} from "@/lib/api";

interface FolderMeeting {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number;
  source: string;
  status: string;
  language: string | null;
  ownerName: string;
  participantCount: number;
  hasTranscript: boolean;
  hasSummary: boolean;
}

export default function FolderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [folder, setFolder] = useState<FolderRow | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [meetings, setMeetings] = useState<FolderMeeting[]>([]);
  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchFolders(), fetchSpaces(), fetchMeetingsInFolder(id)]).then(
      ([folderResult, spaceResult, meetingResult]) => {
        if (folderResult.data) {
          setFolders(folderResult.data.folders);
          const match = folderResult.data.folders.find((row) => row.id === id) ?? null;
          setFolder(match);
          if (!match) setNotFound(true);
        }
        if (spaceResult.data) {
          setSpaceName(null);
        }
        if (meetingResult.data) setMeetings(meetingResult.data.meetings);
        const failure = folderResult.error ?? meetingResult.error;
        if (failure) setError(failure);
        setLoading(false);
      },
    );
  };

  useEffect(load, [id]);

  useEffect(() => {
    if (!folder?.spaceId) {
      setSpaceName(null);
      return;
    }
    fetchSpaces().then((result) => {
      if (!result.data) return;
      const space = result.data.spaces.find((row) => row.id === folder.spaceId);
      setSpaceName(space?.name ?? null);
    });
  }, [folder?.spaceId]);

  const otherFolders = useMemo(
    () => folders.filter((row) => row.id !== id),
    [folders, id],
  );

  const move = async (meeting: FolderMeeting, folderId: string) => {
    const nextId = folderId === "none" ? null : folderId || null;
    const target = nextId ? otherFolders.find((row) => row.id === nextId) : null;
    const result = await moveMeetingToFolder(meeting.id, nextId);
    if (result.error) {
      toast.push({
        tone: "error",
        title: "The meeting did not move",
        description: result.error,
      });
      return;
    }
    setMeetings((current) => current.filter((row) => row.id !== meeting.id));
    toast.push({
      tone: "success",
      title: "Meeting moved",
      description: target ? `Now in ${target.name}.` : "Removed from this folder.",
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/app/folders" className="mb-3 inline-block text-sm text-accent hover:underline">
        ← All folders
      </Link>

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28" rounded="lg" />
          <Skeleton className="h-40" rounded="lg" />
        </div>
      ) : notFound ? (
        <Card>
          <EmptyState
            title="Folder not found"
            description="It may have been deleted or you may not have access to it."
            action={
              <Link href="/app/folders">
                <Button size="sm">Back to folders</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-text">{folder?.name ?? "Folder"}</h2>
                <p className="mt-1 max-w-2xl text-sm text-text-muted">
                  {folder?.description || "No description yet."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{meetings.length} meetings</Badge>
                {spaceName ? <Badge>{spaceName}</Badge> : null}
                {folder?.linkAccess ? <Badge>{folder.linkAccess} access</Badge> : null}
              </div>
            </div>
          </Card>

          {error ? (
            <Banner
              tone="danger"
              title="Could not load this folder"
              action={
                <Button variant="secondary" size="sm" onClick={load}>
                  Retry
                </Button>
              }
            >
              {error}
            </Banner>
          ) : null}

          <h3 className="mb-2 text-sm font-semibold text-text">Meetings in this folder</h3>
          {meetings.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing filed here yet"
                description="Move a meeting into this folder from the meetings library or a meeting page."
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
                    <div className="flex items-center gap-2">
                      <label
                        className="whitespace-nowrap text-xs text-text-muted"
                        htmlFor={`move-${meeting.id}`}
                      >
                        Move to
                      </label>
                      <Select
                        id={`move-${meeting.id}`}
                        className="w-44"
                        value=""
                        onChange={(event) => move(meeting, event.target.value)}
                      >
                        <option value="">Choose folder…</option>
                        {otherFolders.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                        <option value="none">Remove from folders</option>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
