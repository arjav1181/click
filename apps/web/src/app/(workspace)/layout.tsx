import { redirect } from "next/navigation";
import { Sidebar, Header } from "@/components/shell";
import { getSession } from "@/server/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/app");
  }

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
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
