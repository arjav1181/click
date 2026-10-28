import { Card, CardHeader, EmptyState } from "@click/ui";

export function ScreenStub({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
          {id}
        </span>
        <h2 className="text-xl font-semibold text-text">{title}</h2>
      </div>
      {description ? <p className="mb-6 text-sm text-text-muted">{description}</p> : null}
      {children ?? (
        <Card>
          <CardHeader title="Coming soon" description="This screen is scaffolded; full implementation lands in the next milestone." />
          <div className="p-4">
            <EmptyState
              title="Not implemented yet"
              description="Routing, data layer and primitives are wired. The full screen will be built in the relevant milestone."
            />
          </div>
        </Card>
      )}
    </div>
  );
}
