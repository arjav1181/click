import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  Badge,
  EmptyState,
} from "@click/ui";
import { CalendarEventCard, MeetingCard } from "@click/ui";
import { calendarsRepo, meetingsRepo, workspaceRepo } from "@click/db";
import { requireOrgSession } from "@/server/auth";
import { NewMeetingButton, RecordNowButton } from "./home-actions";

export default async function HomePage() {
  const session = await requireOrgSession();
  const ctx = { orgId: session.orgId, userId: session.id };
  const now = Date.now();

  const [{ meetings }, events, usage] = await Promise.all([
    meetingsRepo.listMeetings(ctx, { limit: 6 }),
    calendarsRepo.listCalendarEvents(ctx, {
      from: new Date(now - 30 * 60 * 1000),
      to: new Date(now + 24 * 60 * 60 * 1000),
    }),
    workspaceRepo.getUsage(ctx),
  ]);

  const upcoming = events.filter((event) => new Date(event.startsAt).getTime() > now - 30 * 60 * 1000);
  const budgetPct = usage.budgetCap > 0 ? Math.round((usage.costEstimate / usage.budgetCap) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">Home</h2>
          <p className="text-sm text-text-muted">
            Today's meetings, quick capture and recent notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/import">
            <Button variant="secondary" size="sm">
              Import recording
            </Button>
          </Link>
          <NewMeetingButton />
        </div>
      </div>

      {budgetPct >= 70 ? (
        <div className="mb-6 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
          AI budget at {budgetPct}% — increase the cap in admin settings if needed.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader
              title="Upcoming"
              description="Meetings on your calendar."
              actions={<Badge>{upcoming.length} today</Badge>}
            />
            <div className="grid gap-2 p-4">
              {upcoming.length === 0 ? (
                <EmptyState
                  title="No upcoming meetings"
                  description="Connect a calendar or schedule a meeting to see it here."
                  action={
                    <Link href="/settings/calendars">
                      <Button variant="secondary" size="sm">
                        Connect calendar
                      </Button>
                    </Link>
                  }
                />
              ) : (
                upcoming.map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    event={{
                      id: event.id,
                      title: event.title ?? "Untitled meeting",
                      startsAt: event.startsAt,
                      endsAt: event.endsAt,
                      meetingUrl: event.meetingUrl,
                      autoJoin: event.autoJoin ?? undefined,
                      botStatus: event.botStatus as never,
                    }}
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent meetings" description="Your latest captured notes." />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {meetings.length === 0 ? (
                <EmptyState title="No meetings yet" description="Import a recording or capture a call to get started." />
              ) : (
                meetings.map((meeting) => (
                  <Link key={meeting.id} href={`/app/meetings/${meeting.id}`} className="block">
                    <MeetingCard
                      meeting={{
                        id: meeting.id,
                        title: meeting.title,
                        startedAt: meeting.startedAt ?? new Date().toISOString(),
                        durationSeconds: meeting.durationSeconds,
                        source: meeting.source as never,
                        status: meeting.status as never,
                        language: meeting.language,
                        participantCount: meeting.participantCount,
                        folderName: meeting.folderName,
                        ownerName: meeting.ownerName,
                      }}
                    />
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text">Quick capture</h3>
            <p className="mt-1 text-xs text-text-muted">
              Start a recording from this device without a bot.
            </p>
            <div className="mt-3 grid gap-2">
              <RecordNowButton />
              <Link href="/app/import">
                <Button variant="secondary" size="sm" className="w-full">
                  Upload a file
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-text">AI budget</h3>
            <p className="mt-1 text-xs text-text-muted">
              {usage.costEstimate.toFixed(2)} of {usage.budgetCap.toFixed(2)} {usage.currency} used this period.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-2">
              <div
                className="h-full rounded-pill bg-accent"
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {usage.asrSeconds.toLocaleString()} ASR seconds ·{" "}
              {(usage.llmTokensIn + usage.llmTokensOut).toLocaleString()} tokens
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
