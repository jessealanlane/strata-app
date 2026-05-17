"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardSubtle,
  CardTitle,
  Checkbox,
  Divider,
  Field,
  Pill,
  Textarea,
  TrashIcon,
  cx
} from "@/components/ui";
import { actions, useAppStore, useCurrentUser, useVoteById } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/model";
import { formatDateTime } from "@/lib/format";

export default function VoteDetailPage() {
  const params = useParams<Record<string, string | string[]>>();
  const voteIdParam = params.voteId ?? params.voteid;
  const voteId = Array.isArray(voteIdParam) ? voteIdParam[0] : voteIdParam;
  const router = useRouter();
  const me = useCurrentUser();

  const safeVoteId = voteId || "";
  const vote = useVoteById(safeVoteId);
  const users = useAppStore((s) => s.users);
  const locations = useAppStore((s) => s.locations);
  const comments = useAppStore((s) => s.voteComments.filter((c) => c.voteId === safeVoteId));

  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [voteComment, setVoteComment] = useState("");

  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>();

  const [editVisibility, setEditVisibility] = useState(false);
  const [excludedDraft, setExcludedDraft] = useState<string[]>([]);

  const [allowOutcomeDraft, setAllowOutcomeDraft] = useState(false);

  useEffect(() => {
    if (!vote) return;
    actions.votes.logView(vote.id);
  }, [vote?.id]);

  useEffect(() => {
    if (!me || !vote) return;
    const mine = vote.votesByUserId[me.id];
    if (mine?.optionId) setSelectedOptionId(mine.optionId);
  }, [me, vote]);

  useEffect(() => {
    if (!vote) return;
    setExcludedDraft(vote.excludedUserIds);
    setAllowOutcomeDraft(vote.allowLotOwnersToViewOutcome);
  }, [vote?.excludedUserIds, vote?.allowLotOwnersToViewOutcome, vote?.id]);

  const creator = useMemo(() => users.find((u) => u.id === vote?.createdByUserId), [users, vote?.createdByUserId]);
  const isCreator = Boolean(me && vote && vote.createdByUserId === me.id);
  const isAdmin = me?.role === "BCM_BCMA";

  const dataUrlToBlob = (dataUrl: string): Blob | null => {
    const comma = dataUrl.indexOf(",");
    if (comma === -1) return null;
    const header = dataUrl.slice(0, comma);
    const data = dataUrl.slice(comma + 1);

    const mimeMatch = /^data:([^;]+)(;|$)/i.exec(header);
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    const isBase64 = /;base64/i.test(header);

    if (isBase64) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mimeType });
    }

    const text = decodeURIComponent(data);
    return new Blob([text], { type: mimeType });
  };

  const openDataUrlInNewTab = (dataUrl: string) => {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) {
      window.open(dataUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || !Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const locationLabel = useMemo(() => {
    if (!vote) return "—";
    if (vote.locationId) return locations.find((l) => l.id === vote.locationId)?.nickname ?? "—";
    return vote.locationText ?? "—";
  }, [vote, locations]);

  const tally = useMemo(() => {
    if (!vote) return [];
    const counts: Record<string, number> = {};
    for (const opt of vote.options) counts[opt.id] = 0;
    for (const choice of Object.values(vote.votesByUserId)) {
      if (!counts[choice.optionId]) counts[choice.optionId] = 0;
      counts[choice.optionId] += 1;
    }
    const total = Object.values(counts).reduce((a, v) => a + v, 0);
    return vote.options.map((o) => ({
      option: o,
      count: counts[o.id] ?? 0,
      total
    }));
  }, [vote]);

  const canSeeOutcome = useMemo(() => {
    if (!me || !vote) return false;
    if (!vote.closedAt) return true;
    if (me.role !== "LOT_OWNER") return true;
    if (isAdmin || isCreator) return true;
    return vote.allowLotOwnersToViewOutcome;
  }, [me, vote, isAdmin, isCreator]);

  const thread = useMemo(() => buildThread(comments, users), [comments, users]);

  if (!me) return null;

  if (!vote) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vote not found</CardTitle>
          <CardSubtle>This vote may have been deleted.</CardSubtle>
        </CardHeader>
        <CardBody>
          <Link href="/votes" className="text-sm font-semibold text-brand-700 hover:underline">
            Back to votes
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (vote.excludedUserIds.includes(me.id)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not available</CardTitle>
          <CardSubtle>You don’t have access to this vote.</CardSubtle>
        </CardHeader>
        <CardBody>
          <Link href="/votes" className="text-sm font-semibold text-brand-700 hover:underline">
            Back to votes
          </Link>
        </CardBody>
      </Card>
    );
  }

  const closed = Boolean(vote.closedAt);
  const myChoice = vote.votesByUserId[me.id];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">{vote.title}</div>
          <div className="mt-1 text-sm text-slate-600">
            {vote.type.replaceAll("_", " ")} · Created by {creator?.email ?? "Unknown"} · {formatDateTime(vote.createdAt)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {closed ? <Pill tone="slate">Closed</Pill> : <Pill tone="green">Open</Pill>}
            {vote.autoApproved ? <Pill tone="blue">Auto-approved</Pill> : null}
            {vote.deadlineAt ? <Pill tone="slate">Deadline {formatDateTime(vote.deadlineAt)}</Pill> : null}
            <Pill tone="slate">Location {locationLabel}</Pill>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {(isCreator || isAdmin) ? (
            <Button
              variant="secondary"
              onClick={() => setEditVisibility((v) => !v)}
            >
              Visibility
            </Button>
          ) : null}
          {(isCreator || isAdmin) ? (
            closed ? (
              <Button variant="secondary" onClick={() => actions.votes.reopenVote(vote.id)}>
                Re-open
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => actions.votes.closeVote(vote.id)}>
                Close
              </Button>
            )
          ) : null}
          {(isCreator || isAdmin) ? (
            <Button
              variant="danger"
              onClick={() => {
                actions.votes.deleteVote(vote.id);
                router.push("/votes");
              }}
            >
              <TrashIcon className="h-5 w-5" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardSubtle>Documents attached to a vote can’t be edited or deleted (delete the whole vote instead).</CardSubtle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{vote.description || "—"}</div>
          {typeof vote.quoteAmount === "number" ? (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
              Quote amount: <span className="font-semibold">${vote.quoteAmount}</span>
            </div>
          ) : null}
          {vote.attachments.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">Attachments</div>
              {vote.attachments.map((a) => {
                const href = a.dataUrl || a.url;
                const name = a.name || "document";
                const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
                const mime = a.mimeType;
                const isDataUrl = typeof href === "string" && /^data:/i.test(href);
                const isPdf = mime === "application/pdf" || ext === "pdf";
                const isImage =
                  (typeof mime === "string" && mime.startsWith("image/")) ||
                  ext === "png" ||
                  ext === "jpg" ||
                  ext === "jpeg" ||
                  ext === "gif" ||
                  ext === "webp" ||
                  ext === "svg";
                const isText = (typeof mime === "string" && mime.startsWith("text/")) || ext === "txt" || ext === "csv";
                const isOffice = ext === "doc" || ext === "docx" || ext === "xls" || ext === "xlsx" || ext === "ppt" || ext === "pptx";
                const canInlinePreview = isPdf || isImage || isText;
                const viewHref =
                  isOffice && a.url && /^https?:\/\//i.test(a.url)
                    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(a.url)}`
                    : href && !isDataUrl && canInlinePreview
                      ? href
                      : undefined;
                const canPreviewDataUrl = Boolean(href && isDataUrl && canInlinePreview);

                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                      <div className="truncate text-xs text-slate-600">{a.url ?? ([formatBytes(a.size), a.mimeType].filter(Boolean).join(" • ") || "—")}</div>
                    </div>
                    {href ? (
                      <div className="flex shrink-0 items-center gap-2">
                        {viewHref ? (
                          <a
                            href={viewHref}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                          >
                            View
                          </a>
                        ) : canPreviewDataUrl ? (
                          <button
                            type="button"
                            onClick={() => openDataUrlInNewTab(href)}
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                          >
                            View
                          </button>
                        ) : (
                          <div className="text-xs font-semibold text-slate-500">Preview not supported</div>
                        )}
                        <a
                          href={href}
                          download={name}
                          className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Download
                        </a>
                        <Pill tone="slate">Locked</Pill>
                      </div>
                    ) : (
                      <Pill tone="slate">Locked</Pill>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {(isCreator || isAdmin) && editVisibility ? (
        <Card>
          <CardHeader>
            <CardTitle>Visibility & outcomes</CardTitle>
            <CardSubtle>Creator or {ROLE_LABEL.BCM_BCMA} only</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Checkbox
              checked={allowOutcomeDraft}
              onChange={(checked) => {
                setAllowOutcomeDraft(checked);
                actions.votes.setAllowLotOwnersToViewOutcome(vote.id, checked);
              }}
              label="Allow lot owners to view outcome when closed"
            />
            <Divider />
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">Exclude users</div>
              <div className="text-xs text-slate-600">Excluded users won’t see this vote.</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {users
                  .slice()
                  .sort((a, b) => a.email.localeCompare(b.email))
                  .map((u) => (
                    <Checkbox
                      key={u.id}
                      checked={excludedDraft.includes(u.id)}
                      onChange={(checked) => {
                        const next = checked ? [...excludedDraft, u.id] : excludedDraft.filter((x) => x !== u.id);
                        setExcludedDraft(next);
                        actions.votes.setExcludedUserIds(vote.id, next);
                      }}
                      label={u.email}
                    />
                  ))}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live tally</CardTitle>
            <CardSubtle>{canSeeOutcome ? "Updates instantly (local state + localStorage)" : "Outcome hidden for lot owners"}</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-3">
            {!canSeeOutcome ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                Outcome is hidden until enabled by the vote creator or {ROLE_LABEL.BCM_BCMA}.
              </div>
            ) : (
              <div className="space-y-2">
                {tally.map((t) => {
                  const pct = t.total > 0 ? Math.round((t.count / t.total) * 100) : 0;
                  return (
                    <div key={t.option.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{t.option.label}</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {t.count} <span className="text-slate-500">({pct}%)</span>
                        </div>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                        <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your vote</CardTitle>
            <CardSubtle>{closed ? "Voting is closed (comments still open)" : "You can change your vote any time before close"}</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="space-y-2">
              {vote.options.map((opt) => {
                const active = selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOptionId(opt.id)}
                    disabled={closed}
                    className={cx(
                      "w-full rounded-2xl p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-60",
                      active ? "bg-brand-50 ring-brand-100" : "bg-white ring-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                  </button>
                );
              })}
            </div>

            <Field label="Optional comment (saved as a vote comment too)">
              <Textarea value={voteComment} onChange={(e) => setVoteComment(e.target.value)} placeholder="Add context for your vote" />
            </Field>

            <Button
              disabled={closed || !selectedOptionId}
              onClick={() => {
                actions.votes.castVote(vote.id, selectedOptionId, voteComment);
                setVoteComment("");
              }}
            >
              {myChoice ? "Update vote" : "Cast vote"}
            </Button>

            {myChoice ? (
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                Current selection: <span className="font-semibold">{vote.options.find((o) => o.id === myChoice.optionId)?.label ?? "—"}</span>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
          <CardSubtle>Replies stay open after close</CardSubtle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            {thread.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No comments yet.</div>
            ) : null}
            {thread.map((c) => (
              <div key={c.id} className="space-y-2">
                <CommentRow
                  id={c.id}
                  author={c.authorEmail}
                  when={c.createdAt}
                  body={c.body}
                  onReply={() => setReplyTo(c.id)}
                  isReply={false}
                />
                {c.replies.map((r) => (
                  <CommentRow
                    key={r.id}
                    id={r.id}
                    author={r.authorEmail}
                    when={r.createdAt}
                    body={r.body}
                    onReply={() => setReplyTo(r.id)}
                    isReply={true}
                  />
                ))}
              </div>
            ))}
          </div>

          <Divider />

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{replyTo ? "Reply" : "Add a comment"}</div>
              {replyTo ? (
                <Button variant="ghost" size="sm" onClick={() => setReplyTo(undefined)}>
                  Cancel reply
                </Button>
              ) : null}
            </div>
            <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Write a comment" />
            <Button
              onClick={() => {
                actions.comments.addVoteComment(vote.id, commentBody, replyTo);
                setCommentBody("");
                setReplyTo(undefined);
              }}
            >
              Post comment
            </Button>
          </div>
        </CardBody>
      </Card>

      {isCreator ? (
        <Card>
          <CardHeader>
            <CardTitle>Who viewed</CardTitle>
            <CardSubtle>Visible to vote creator only</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-2">
            {vote.views.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No views recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {vote.views
                  .slice()
                  .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
                  .map((v) => (
                    <div key={v.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {users.find((u) => u.id === v.userId)?.email ?? "Unknown"}
                      </div>
                      <div className="shrink-0 text-xs text-slate-500">{formatDateTime(v.viewedAt)}</div>
                    </div>
                  ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function CommentRow({
  id,
  author,
  when,
  body,
  onReply,
  isReply
}: {
  id: string;
  author: string;
  when: string;
  body: string;
  onReply: () => void;
  isReply: boolean;
}) {
  return (
    <div className={cx("rounded-2xl bg-white p-3 ring-1 ring-slate-200", isReply ? "ml-6" : "")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{author}</div>
          <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{body}</div>
        </div>
        <div className="shrink-0 text-xs text-slate-500">{formatDateTime(when)}</div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-slate-500">{id}</div>
        <button onClick={onReply} className="text-xs font-semibold text-brand-700 hover:underline">
          Reply
        </button>
      </div>
    </div>
  );
}

type ThreadComment = {
  id: string;
  createdAt: string;
  authorEmail: string;
  body: string;
  replies: Array<{ id: string; createdAt: string; authorEmail: string; body: string }>;
};

function buildThread(
  comments: Array<{ id: string; userId: string; createdAt: string; body: string; parentId?: string }>,
  users: Array<{ id: string; email: string }>
): ThreadComment[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const top = comments.filter((c) => !c.parentId || !byId.has(c.parentId));
  const repliesByParent: Record<string, typeof comments> = {};
  for (const c of comments) {
    if (!c.parentId) continue;
    if (!repliesByParent[c.parentId]) repliesByParent[c.parentId] = [];
    repliesByParent[c.parentId].push(c);
  }

  const emailById = new Map(users.map((u) => [u.id, u.email]));

  return top
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      authorEmail: emailById.get(c.userId) ?? "Unknown",
      body: c.body,
      replies: (repliesByParent[c.id] ?? [])
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          authorEmail: emailById.get(r.userId) ?? "Unknown",
          body: r.body
        }))
    }));
}
