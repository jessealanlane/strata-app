"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardSubtle, CardTitle, Pill, PlusIcon, Tabs } from "@/components/ui";
import { useAppStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/model";
import { formatDateTime } from "@/lib/format";

export default function VotesPage() {
  const me = useCurrentUser();
  const votes = useAppStore((s) => s.votes);
  const users = useAppStore((s) => s.users);

  const [tab, setTab] = useState<"open" | "closed">("open");

  const visibleVotes = useMemo(() => {
    if (!me) return [];
    return votes.filter((v) => !v.excludedUserIds.includes(me.id));
  }, [me, votes]);

  const openVotes = useMemo(() => visibleVotes.filter((v) => !v.closedAt), [visibleVotes]);
  const closedVotes = useMemo(() => visibleVotes.filter((v) => Boolean(v.closedAt)), [visibleVotes]);

  if (!me) return null;

  const list = tab === "open" ? openVotes : closedVotes;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">Votes</div>
          <div className="text-sm text-slate-600">Open and closed votes you’re allowed to see.</div>
        </div>
        {can(me.role, "VOTE_CREATE") ? (
          <Link href="/votes/new" className="w-full sm:w-auto">
            <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              <PlusIcon className="h-5 w-5" />
              Create vote
            </span>
          </Link>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as "open" | "closed")}
          items={[
            { value: "open", label: "Open", right: <Pill tone="slate">{openVotes.length}</Pill> },
            { value: "closed", label: "Closed", right: <Pill tone="slate">{closedVotes.length}</Pill> }
          ]}
        />
        <Button variant="secondary" onClick={() => setTab(tab === "open" ? "closed" : "open")}>
          Toggle
        </Button>
      </div>

      <div className="space-y-3">
        {list.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-sm text-slate-600">{tab === "open" ? "No open votes." : "No closed votes."}</div>
            </CardBody>
          </Card>
        ) : null}

        {list
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((v) => {
            const createdBy = users.find((u) => u.id === v.createdByUserId);
            const myChoice = v.votesByUserId[me.id];
            const isClosed = Boolean(v.closedAt);
            return (
              <Link key={v.id} href={`/votes/${v.id}`} className="block">
                <Card className="transition hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>{v.title}</CardTitle>
                        <CardSubtle>
                          {v.type.replaceAll("_", " ")} · Created by {createdBy?.email ?? "Unknown"} · {formatDateTime(v.createdAt)}
                        </CardSubtle>
                      </div>
                      <div className="shrink-0 text-right">
                        {isClosed ? <Pill tone="slate">Closed</Pill> : <Pill tone="green">Open</Pill>}
                        {v.autoApproved ? <div className="mt-1"><Pill tone="blue">Auto-approved</Pill></div> : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-700">{v.description || "—"}</div>
                    <div className="flex shrink-0 items-center gap-2">
                      {myChoice ? <Pill tone="blue">You voted</Pill> : !isClosed ? <Pill tone="red">Not voted</Pill> : <Pill tone="slate">No vote</Pill>}
                      {v.deadlineAt ? <Pill tone="slate">Deadline {formatDateTime(v.deadlineAt)}</Pill> : null}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
