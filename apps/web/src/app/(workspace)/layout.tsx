import { redirect } from "next/navigation";
import { authRepo } from "@click/db";
import { Sidebar, Header } from "@/components/shell";
import { getSession } from "@/server/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/app");
  }

  // The switcher lists every workspace the account belongs to, not only the
  // open one, so it needs the full membership list.
  const memberships = await authRepo.listMemberships(session.id);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={{
            name: session.name,
            email: session.email,
            orgName: session.orgName,
          }}
          workspaces={memberships.map((membership) => ({
            id: membership.orgId,
            name: membership.orgName,
            slug: membership.orgSlug,
            role: membership.role,
          }))}
          activeWorkspaceId={session.orgId}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
