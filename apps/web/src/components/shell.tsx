"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, ThemeToggle } from "@click/ui";

const navSections: { title: string; items: { href: string; label: string; screen?: string }[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/app", label: "Home", screen: "S07" },
      { href: "/app/meetings", label: "Meetings", screen: "S08" },
      { href: "/app/search", label: "Search", screen: "S41" },
      { href: "/app/tasks", label: "Tasks", screen: "S36" },
      { href: "/app/ask", label: "Ask AI", screen: "S37" },
      { href: "/app/feed", label: "Feed", screen: "S35" },
    ],
  },
  {
    title: "Organise",
    items: [
      { href: "/app/channels", label: "Channels", screen: "S26" },
      { href: "/app/folders", label: "Folders & spaces", screen: "S27" },
      { href: "/app/people", label: "People", screen: "S28" },
      { href: "/app/companies", label: "Companies", screen: "S29" },
      { href: "/app/templates", label: "Templates", screen: "S30" },
      { href: "/app/recipes", label: "Recipes", screen: "S31" },
      { href: "/app/skills", label: "Skills", screen: "S33" },
      { href: "/app/soundbites", label: "Soundbites", screen: "S19" },
    ],
  },
  {
    title: "Capture",
    items: [
      { href: "/app/import", label: "Import recording", screen: "S42" },
      { href: "/app/integrations", label: "Integrations", screen: "S44" },
      { href: "/app/developers", label: "Developers", screen: "S45" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings", label: "Personal settings", screen: "S47" },
      { href: "/settings/calendars", label: "Calendars", screen: "S05" },
      { href: "/settings/speakers", label: "Speakers", screen: "S48" },
      { href: "/settings/vocabulary", label: "Vocabulary", screen: "S49" },
      { href: "/settings/privacy", label: "Consent & privacy", screen: "S50" },
      { href: "/settings/retention", label: "Retention", screen: "S51" },
      { href: "/settings/notifications", label: "Notifications", screen: "S52" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/general", label: "Workspace", screen: "S06" },
      { href: "/admin/members", label: "Members", screen: "S53" },
      { href: "/admin/groups", label: "Groups", screen: "S54" },
      { href: "/admin/recording", label: "Recording policy", screen: "S55" },
      { href: "/admin/ai", label: "AI policy", screen: "S56" },
      { href: "/admin/analytics", label: "Analytics", screen: "S57" },
      { href: "/admin/audit", label: "Audit log", screen: "S58" },
      { href: "/admin/legal-hold", label: "Legal hold", screen: "S59" },
      { href: "/admin/instance", label: "Instance ops", screen: "S60" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-on-accent">
          C
        </span>
        <span className="text-base font-semibold text-text">Click</span>
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {section.title}
            </p>
            <ul className="grid gap-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                        active
                          ? "bg-accent-soft font-semibold text-accent"
                          : "text-text-muted hover:bg-surface-2 hover:text-text"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.screen ? (
                        <span className="text-[10px] text-text-muted/60">{item.screen}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export interface HeaderUser {
  name: string | null;
  email: string;
  orgName: string | null;
}

export function Header({ title, user }: { title?: string; user?: HeaderUser }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const initials = (user?.name ?? user?.email ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 lg:hidden"
          aria-label="Open navigation"
        >
          ☰
        </button>
        <h1 className="truncate text-base font-semibold text-text">{title ?? "Click"}</h1>
        {user?.orgName ? (
          <span className="hidden truncate rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted sm:inline">
            {user.orgName}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm">
          Record
        </Button>
        <Button size="sm">New meeting</Button>
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent"
            >
              {initials}
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg"
              >
                <p className="px-2 py-1 text-sm font-medium text-text">{user.name ?? user.email}</p>
                <p className="px-2 pb-2 text-xs text-text-muted">{user.email}</p>
                <Link
                  href="/settings"
                  role="menuitem"
                  className="block rounded-md px-2 py-1.5 text-sm text-text-muted hover:bg-surface-2 hover:text-text"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setMenuOpen(false);
                    await fetch("/api/v1/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}
                  className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
