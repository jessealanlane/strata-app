"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { actions, useCurrentUser, useUnreadNotificationCount } from "@/lib/store";
import { ROLE_LABEL, can } from "@/lib/model";
import { AdminIcon, BadgeCount, Button, Card, Container, HomeIcon, Pill, VoteIcon, cx } from "@/components/ui";
import { NotificationBell } from "@/components/Notifications";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useCurrentUser();
  const unread = useUnreadNotificationCount();

  if (!me) return <div className="min-h-screen bg-slate-50">{children}</div>;

  const nav = [
    { href: "/", label: "Dashboard", icon: <HomeIcon className="h-5 w-5" />, show: true },
    { href: "/votes", label: "Votes", icon: <VoteIcon className="h-5 w-5" />, show: true },
    { href: "/admin", label: "Admin", icon: <AdminIcon className="h-5 w-5" />, show: can(me.role, "ADMIN_VIEW") }
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-64 md:border-r md:border-slate-200 md:bg-white">
        <div className="flex h-full flex-col">
          <div className="px-5 pt-6">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">StrataVote</div>
            <div className="text-sm font-semibold text-brand-700">BCS Southport</div>
          </div>
          <nav className="mt-6 flex-1 space-y-2 px-3">
            {nav.map((item) => (
              <NavItem key={item.href} href={item.href} active={isActive(pathname, item.href)} icon={item.icon}>
                {item.label}
                {item.href === "/admin" && unread > 0 ? <span className="ml-auto"><BadgeCount count={unread} /></span> : null}
              </NavItem>
            ))}
          </nav>
          <div className="p-4">
            <Card className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{me.email}</div>
                  <div className="mt-1">
                    <Pill>{me.role ? ROLE_LABEL[me.role] : "Role not set"}</Pill>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    actions.auth.logout();
                    router.push("/login");
                  }}
                >
                  Logout
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="md:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
          <Container>
            <div className="flex h-16 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {me.role ? ROLE_LABEL[me.role] : "Select a role"}
                  </div>
                  {!me.approved ? <div className="truncate text-xs font-semibold text-rose-700">Pending approval (test mode)</div> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <div className="hidden sm:block md:hidden">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      actions.auth.logout();
                      router.push("/login");
                    }}
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </Container>
        </header>

        <main className="pb-20 md:pb-10">
          <Container>
            <div className="py-6">{children}</div>
          </Container>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-3 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "relative flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold",
                isActive(pathname, item.href) ? "bg-brand-50 text-brand-700" : "text-slate-600"
              )}
            >
              <span className="text-slate-700">{item.icon}</span>
              <span>{item.label}</span>
              {item.href === "/admin" ? (
                <span className="absolute right-4 top-2">
                  <BadgeCount count={unread} />
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  active,
  icon,
  children
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
        active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
      )}
    >
      <span className={cx("shrink-0", active ? "text-brand-700" : "text-slate-600")}>{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

