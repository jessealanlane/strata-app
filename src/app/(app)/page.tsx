"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardSubtle, CardTitle, Checkbox, Divider, Field, Input, Modal, Pill, Stat, Textarea, TrashIcon, cx } from "@/components/ui";
import { actions, useAppStore, useCurrentUser } from "@/lib/store";
import type { BuildingManagerUpdateAttachment } from "@/lib/model";
import { can, ROLE_LABEL } from "@/lib/model";
import { formatDateTime, formatDateTimeInTimeZone, isValidTimeZone, utcIsoToZonedLocalInput, zonedLocalInputToUtcIso } from "@/lib/format";

export default function DashboardPage() {
  const me = useCurrentUser();
  const settings = useAppStore((s) => s.settings);
  const votes = useAppStore((s) => s.votes);
  const bmUpdates = useAppStore((s) => s.bmUpdates);
  const users = useAppStore((s) => s.users);
  const ideas = useAppStore((s) => s.ideas);

  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaBody, setIdeaBody] = useState("");

  const [scheduleOpen, setScheduleOpen] = useState<null | "committee" | "agm">(null);
  const [scheduleWhen, setScheduleWhen] = useState("");
  const [scheduleLocation, setScheduleLocation] = useState("");
  const [scheduleTz, setScheduleTz] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [bmTitle, setBmTitle] = useState("");
  const [bmBody, setBmBody] = useState("");
  const [bmUrgent, setBmUrgent] = useState(false);
  const [bmAttachments, setBmAttachments] = useState<Array<Pick<BuildingManagerUpdateAttachment, "name" | "mimeType" | "size" | "dataUrl">>>([]);
  const [bmAttachError, setBmAttachError] = useState<string | null>(null);

  const [editUpdateId, setEditUpdateId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editUrgent, setEditUrgent] = useState(false);
  const [editAttachments, setEditAttachments] = useState<BuildingManagerUpdateAttachment[]>([]);
  const [editAttachError, setEditAttachError] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!me) return { cast: 0, pending: 0 };
    const visibleOpen = votes.filter((v) => !v.closedAt && !v.excludedUserIds.includes(me.id));
    const cast = visibleOpen.filter((v) => Boolean(v.votesByUserId[me.id])).length;
    const pending = visibleOpen.filter((v) => !v.votesByUserId[me.id]).length;
    return { cast, pending };
  }, [me, votes]);

  const urgentCount = useMemo(() => bmUpdates.filter((u) => u.urgent).length, [bmUpdates]);

  const pendingApprovals = useMemo(
    () => users.filter((u) => u.role && u.approved === false),
    [users]
  );

  if (!me) return null;

  const editOpen = Boolean(editUpdateId);
  const editing = editUpdateId ? bmUpdates.find((u) => u.id === editUpdateId) : undefined;
  const canManageUpdate = (u: { createdByUserId: string }) => me.role === "BCM_BCMA" || (me.role === "BUILDING_MANAGER" && u.createdByUserId === me.id);

  const maxBytes = 2_000_000;
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });

  const formatBytes = (bytes?: number) => {
    if (!bytes || !Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const openSchedule = (kind: "committee" | "agm") => {
    setScheduleError(null);
    setScheduleOpen(kind);
    setScheduleTz(settings.buildingTimeZone);
    if (kind === "committee") {
      setScheduleWhen(utcIsoToZonedLocalInput(settings.nextCommitteeMeeting?.when, settings.buildingTimeZone));
      setScheduleLocation(settings.nextCommitteeMeeting?.locationNickname ?? "");
    } else {
      setScheduleWhen(utcIsoToZonedLocalInput(settings.nextAgm?.when, settings.buildingTimeZone));
      setScheduleLocation(settings.nextAgm?.locationNickname ?? "");
    }
  };

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

  return (
    <div className="space-y-6">
      <Modal
        open={Boolean(scheduleOpen)}
        onClose={() => {
          setScheduleOpen(null);
          setScheduleError(null);
        }}
        title={scheduleOpen === "committee" ? "Edit next committee meeting" : "Edit next AGM"}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setScheduleOpen(null);
                setScheduleError(null);
              }}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!scheduleOpen) return;
                  if (scheduleOpen === "committee") actions.admin.setNextCommitteeMeeting("", "");
                  else actions.admin.setNextAgm("", "");
                  setScheduleOpen(null);
                  setScheduleError(null);
                }}
              >
                Clear
              </Button>
              <Button
                onClick={() => {
                  if (!scheduleOpen) return;
                  const tzToUse = (can(me.role, "ADMIN_SETTINGS") ? scheduleTz : settings.buildingTimeZone).trim();
                  if (!isValidTimeZone(tzToUse)) {
                    setScheduleError("Invalid building time zone (use an IANA name like Australia/Brisbane).");
                    return;
                  }
                  if (can(me.role, "ADMIN_SETTINGS") && tzToUse !== settings.buildingTimeZone) {
                    actions.admin.setBuildingTimeZone(tzToUse);
                  }
                  const whenIso = scheduleWhen.trim() ? zonedLocalInputToUtcIso(scheduleWhen, tzToUse) : null;
                  if (scheduleWhen.trim() && !whenIso) {
                    setScheduleError("Invalid date/time.");
                    return;
                  }
                  const whenToSave = whenIso || "";
                  if (scheduleOpen === "committee") actions.admin.setNextCommitteeMeeting(whenToSave, scheduleLocation);
                  else actions.admin.setNextAgm(whenToSave, scheduleLocation);
                  setScheduleOpen(null);
                  setScheduleError(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Date/time">
            <Input value={scheduleWhen} onChange={(e) => setScheduleWhen(e.target.value)} type="datetime-local" />
          </Field>
          <Field label="Building time zone">
            <div className="space-y-1">
              {can(me.role, "ADMIN_SETTINGS") ? (
                <Input value={scheduleTz} onChange={(e) => setScheduleTz(e.target.value)} placeholder="Example: Australia/Brisbane" />
              ) : (
                <div className="text-sm font-semibold text-slate-900">{settings.buildingTimeZone}</div>
              )}
              <div className="text-xs text-slate-600">
                Enter times in the building time zone. Everyone will see the time converted to their local time.
              </div>
            </div>
          </Field>
          <Field label="Location">
            <Input value={scheduleLocation} onChange={(e) => setScheduleLocation(e.target.value)} placeholder="Example: Meeting Room" />
          </Field>
          {scheduleError ? <div className="text-sm font-semibold text-rose-700">{scheduleError}</div> : null}
          {!can(me.role, "SCHEDULE_EDIT") ? (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
              Committee permission required.
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => {
          setEditUpdateId(null);
          setEditAttachError(null);
        }}
        title="Edit update"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setEditUpdateId(null);
                setEditAttachError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editUpdateId) return;
                actions.bmUpdates.updateUpdate(editUpdateId, {
                  title: editTitle,
                  body: editBody,
                  urgent: editUrgent,
                  attachments: editAttachments
                });
                setEditUpdateId(null);
                setEditAttachError(null);
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Title">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Weekly report" />
          </Field>
          <Field label="Details">
            <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="What changed this week?" />
          </Field>
          <Checkbox checked={editUrgent} onChange={setEditUrgent} label="Mark as urgent (shows red)" />

          <Divider />

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">Documents</div>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                const inputEl = e.currentTarget;
                inputEl.value = "";
                setEditAttachError(null);
                for (const f of files) {
                  if (f.size > maxBytes) {
                    setEditAttachError(`"${f.name}" is too large. Keep documents under ${formatBytes(maxBytes)} for local testing.`);
                    continue;
                  }
                  const dataUrl = await readFileAsDataUrl(f);
                  setEditAttachments((prev) => [{ id: `new-${Math.random().toString(16).slice(2)}`, name: f.name, mimeType: f.type, size: f.size, dataUrl }, ...prev]);
                }
              }}
            />
            {editAttachError ? <div className="text-sm font-semibold text-rose-700">{editAttachError}</div> : null}
            <div className="space-y-2">
              {(editAttachments ?? []).length === 0 ? <div className="text-sm text-slate-600">No documents attached.</div> : null}
              {(editAttachments ?? []).map((a, idx) => (
                <div key={a.id || `${a.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{a.name}</div>
                    <div className="truncate text-xs text-slate-600">{[formatBytes(a.size), a.mimeType].filter(Boolean).join(" • ") || "—"}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {editing && !canManageUpdate(editing) ? (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">You can only edit your own updates.</div>
          ) : null}
        </div>
      </Modal>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Next Committee Meeting</CardTitle>
            <CardSubtle>{settings.nextCommitteeMeeting?.locationNickname ?? "—"}</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">{formatDateTime(settings.nextCommitteeMeeting?.when)}</div>
            <div className="text-xs text-slate-600">
              Building time: {formatDateTimeInTimeZone(settings.nextCommitteeMeeting?.when, settings.buildingTimeZone)} ({settings.buildingTimeZone})
            </div>
            {can(me.role, "SCHEDULE_EDIT") ? (
              <Button variant="secondary" size="sm" onClick={() => openSchedule("committee")}>
                Edit
              </Button>
            ) : (
              <Pill tone="blue">Committee only</Pill>
            )}
          </CardBody>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Next AGM</CardTitle>
            <CardSubtle>{settings.nextAgm?.locationNickname ?? "—"}</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">{formatDateTime(settings.nextAgm?.when)}</div>
            <div className="text-xs text-slate-600">
              Building time: {formatDateTimeInTimeZone(settings.nextAgm?.when, settings.buildingTimeZone)} ({settings.buildingTimeZone})
            </div>
            {can(me.role, "SCHEDULE_EDIT") ? (
              <Button variant="secondary" size="sm" onClick={() => openSchedule("agm")}>
                Edit
              </Button>
            ) : (
              <Pill tone="blue">Committee only</Pill>
            )}
          </CardBody>
        </Card>

        <Link href="/votes" className="block md:col-span-1">
          <Card className="h-full transition hover:shadow-lg">
            <CardHeader>
              <CardTitle>Voting Summary</CardTitle>
              <CardSubtle>Open votes you can see</CardSubtle>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Stat label="Votes cast" value={stats.cast} />
              <Stat label="Still to vote" value={stats.pending} />
            </CardBody>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Building Manager Updates</CardTitle>
                <CardSubtle>Weekly reports + urgent items</CardSubtle>
              </div>
              {urgentCount > 0 ? <Pill tone="red">{urgentCount} urgent</Pill> : <Pill tone="slate">All clear</Pill>}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="space-y-2">
              {bmUpdates.slice(0, 4).map((u) => (
                <div key={u.id} className={cx("rounded-2xl p-3 ring-1", u.urgent ? "bg-rose-50 ring-rose-100" : "bg-slate-50 ring-slate-200")}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{u.title}</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{u.body}</div>
                      </div>
                      <div className="shrink-0 text-xs text-slate-500">{formatDateTime(u.createdAt)}</div>
                    </div>

                    {(u.attachments ?? []).length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-600">Documents</div>
                        <div className="space-y-1">
                          {(u.attachments ?? []).map((a, idx) => {
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
                              <div key={a.id || `${a.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-200">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
                                  <div className="truncate text-xs text-slate-600">{[formatBytes(a.size), a.mimeType].filter(Boolean).join(" • ") || "—"}</div>
                                </div>
                                {href ? (
                                  <div className="shrink-0 flex items-center gap-2">
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
                                  </div>
                                ) : (
                                  <div className="shrink-0 text-xs text-slate-500">No file</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {canManageUpdate(u) ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditUpdateId(u.id);
                            setEditTitle(u.title);
                            setEditBody(u.body);
                            setEditUrgent(u.urgent);
                            setEditAttachments(u.attachments ?? []);
                            setEditAttachError(null);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            const ok = confirm("Delete this update? This cannot be undone.");
                            if (!ok) return;
                            actions.bmUpdates.deleteUpdate(u.id);
                            if (editUpdateId === u.id) setEditUpdateId(null);
                          }}
                        >
                          <TrashIcon className="h-5 w-5" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {bmUpdates.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No updates yet.</div>
              ) : null}
            </div>

            {can(me.role, "BM_UPDATE_CREATE") ? (
              <>
                <Divider />
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Post an update</div>
                  <Field label="Title">
                    <input
                      value={bmTitle}
                      onChange={(e) => setBmTitle(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      placeholder="Weekly report"
                    />
                  </Field>
                  <Field label="Details">
                    <Textarea value={bmBody} onChange={(e) => setBmBody(e.target.value)} placeholder="What changed this week?" />
                  </Field>
                  <Field label="Documents" hint={`Documents are stored in your browser for testing. Keep files under ${formatBytes(maxBytes)}.`}>
                    <div className="space-y-2">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? []);
                          if (files.length === 0) return;
                          const inputEl = e.currentTarget;
                          inputEl.value = "";
                          setBmAttachError(null);
                          for (const f of files) {
                            if (f.size > maxBytes) {
                              setBmAttachError(`"${f.name}" is too large. Keep documents under ${formatBytes(maxBytes)} for local testing.`);
                              continue;
                            }
                            const dataUrl = await readFileAsDataUrl(f);
                            setBmAttachments((prev) => [{ name: f.name, mimeType: f.type, size: f.size, dataUrl }, ...prev]);
                          }
                        }}
                      />
                      {bmAttachError ? <div className="text-sm font-semibold text-rose-700">{bmAttachError}</div> : null}
                      <div className="space-y-2">
                        {bmAttachments.length === 0 ? <div className="text-sm text-slate-600">No documents attached.</div> : null}
                        {bmAttachments.map((a, idx) => (
                          <div key={`${a.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{a.name}</div>
                              <div className="truncate text-xs text-slate-600">{[formatBytes(a.size), a.mimeType].filter(Boolean).join(" • ") || "—"}</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setBmAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <Checkbox checked={bmUrgent} onChange={setBmUrgent} label="Mark as urgent (shows red)" />
                  <Button
                    onClick={() => {
                      actions.bmUpdates.createUpdate({ title: bmTitle, body: bmBody, urgent: bmUrgent, attachments: bmAttachments });
                      setBmTitle("");
                      setBmBody("");
                      setBmUrgent(false);
                      setBmAttachments([]);
                      setBmAttachError(null);
                    }}
                  >
                    Post update
                  </Button>
                </div>
              </>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Future Ideas</CardTitle>
            <CardSubtle>Any user can post ideas and vote them up/down</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="space-y-2">
              {ideas.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No ideas yet. Add the first one.</div>
              ) : null}
              {ideas.slice(0, 6).map((idea) => {
                const score = Object.values(idea.votesByUserId).reduce((a, v) => a + v, 0);
                const myVote = idea.votesByUserId[me.id];
                return (
                  <div key={idea.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{idea.title}</div>
                        <div className="mt-1 text-sm text-slate-700">{idea.body}</div>
                      </div>
                      <Pill tone={score > 0 ? "green" : score < 0 ? "red" : "slate"}>{score}</Pill>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant={myVote === 1 ? "primary" : "secondary"} size="sm" onClick={() => actions.ideas.voteIdea(idea.id, 1)}>
                        Upvote
                      </Button>
                      <Button variant={myVote === -1 ? "danger" : "secondary"} size="sm" onClick={() => actions.ideas.voteIdea(idea.id, -1)}>
                        Downvote
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Divider />

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Post an idea</div>
              <Field label="Title">
                <input
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  placeholder="Example: Add SMS notifications"
                />
              </Field>
              <Field label="Details">
                <Textarea value={ideaBody} onChange={(e) => setIdeaBody(e.target.value)} placeholder="Describe the idea and why it matters." />
              </Field>
              <Button
                onClick={() => {
                  actions.ideas.postIdea(ideaTitle, ideaBody);
                  setIdeaTitle("");
                  setIdeaBody("");
                }}
              >
                Post idea
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Notification preferences</CardTitle>
              <CardSubtle>You control your own preferences. Admin overrides may apply.</CardSubtle>
            </div>
            {settings.notificationOverridesByUserId[me.id] ? <Pill tone="blue">Override active</Pill> : <Pill tone="slate">Personal</Pill>}
          </div>
        </CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-2">
          <Checkbox
            checked={me.notificationPrefs.enabled}
            onChange={(checked) => actions.users.updateCurrentUserNotificationPrefs({ enabled: checked })}
            label="Enabled"
          />
          <Checkbox
            checked={me.notificationPrefs.votes}
            onChange={(checked) => actions.users.updateCurrentUserNotificationPrefs({ votes: checked })}
            label="Votes"
          />
          <Checkbox
            checked={me.notificationPrefs.updates}
            onChange={(checked) => actions.users.updateCurrentUserNotificationPrefs({ updates: checked })}
            label="Updates"
          />
          <Checkbox
            checked={me.notificationPrefs.ideas}
            onChange={(checked) => actions.users.updateCurrentUserNotificationPrefs({ ideas: checked })}
            label="Ideas"
          />
          <Checkbox
            checked={me.notificationPrefs.admin}
            onChange={(checked) => actions.users.updateCurrentUserNotificationPrefs({ admin: checked })}
            label="Admin"
          />
        </CardBody>
      </Card>

      {me.role === "BCM_BCMA" ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending user approvals</CardTitle>
            <CardSubtle>Visible only to {ROLE_LABEL.BCM_BCMA}</CardSubtle>
          </CardHeader>
          <CardBody className="space-y-3">
            {pendingApprovals.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No pending users.</div>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.slice(0, 6).map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{u.email}</div>
                      <div className="text-xs text-slate-600">{u.role ? ROLE_LABEL[u.role] : "Role not set"}</div>
                    </div>
                    <Link href="/admin" className="text-sm font-semibold text-brand-700 hover:underline">
                      Review
                    </Link>
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
