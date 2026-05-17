"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actions, useNotificationsForCurrentUser, useUnreadNotificationCount, useCurrentUser } from "@/lib/store";
import { BadgeCount, BellIcon, Button, CardSubtle, IconButton, Modal, Pill, cx } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export function NotificationBell() {
  const router = useRouter();
  const me = useCurrentUser();
  const unread = useUnreadNotificationCount();
  const notifications = useNotificationsForCurrentUser();
  const [open, setOpen] = useModalState();

  if (!me) return null;

  return (
    <>
      <IconButton onClick={() => setOpen(true)} ariaLabel="Notifications">
        <BellIcon className="h-5 w-5" />
        <span className="absolute -right-1 -top-1">
          <BadgeCount count={unread} />
        </span>
      </IconButton>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => actions.notifications.clearAllForCurrentUser()}>
              Clear all
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => actions.notifications.markAllReadForCurrentUser()}>
                Mark all read
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No notifications.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  actions.notifications.markRead(n.id);
                  if (n.href) router.push(n.href);
                  setOpen(false);
                }}
                className={cx(
                  "w-full rounded-2xl p-4 text-left ring-1 transition",
                  n.readAt ? "bg-white ring-slate-200 hover:bg-slate-50" : "bg-brand-50 ring-brand-100 hover:bg-brand-100"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">{n.title}</div>
                      {!n.readAt ? <Pill tone="red">New</Pill> : null}
                    </div>
                    {n.body ? <CardSubtle>{n.body}</CardSubtle> : null}
                  </div>
                  <div className="shrink-0 text-xs text-slate-500">{formatDateTime(n.createdAt)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}

function useModalState(): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(false);
  return [open, setOpen];
}
