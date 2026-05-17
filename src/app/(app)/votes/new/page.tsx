"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardSubtle, CardTitle, Checkbox, Divider, Field, Input, Pill, Select, Textarea } from "@/components/ui";
import { actions, useAppStore, useCurrentUser } from "@/lib/store";
import { can, ROLE_LABEL } from "@/lib/model";
import type { Role, VoteType } from "@/lib/model";

const TYPE_OPTIONS: Array<{ value: VoteType; label: string }> = [
  { value: "QUOTE", label: "Quote" },
  { value: "COMMITTEE_MEETING", label: "Committee Meeting" },
  { value: "LOT_OWNER_REQUEST", label: "Lot Owner Request" }
];

export default function NewVotePage() {
  const router = useRouter();
  const me = useCurrentUser();
  const locations = useAppStore((s) => s.locations);
  const users = useAppStore((s) => s.users);
  const settings = useAppStore((s) => s.settings);

  const [type, setType] = useState<VoteType>("QUOTE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [deadlineAt, setDeadlineAt] = useState<string>("");

  const [locationId, setLocationId] = useState<string>("");
  const [newLocationNickname, setNewLocationNickname] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");

  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; url?: string; mimeType?: string; size?: number; dataUrl?: string }>>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const [optionsText, setOptionsText] = useState("Approve\nDeny\nAbstain");
  const [minimumQuorum, setMinimumQuorum] = useState<string>("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [allowLotOwnersToViewOutcome, setAllowLotOwnersToViewOutcome] = useState(false);

  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);

  const locationOptions = useMemo(() => {
    const opts = locations
      .slice()
      .sort((a, b) => a.nickname.localeCompare(b.nickname))
      .map((l) => ({ value: l.id, label: l.nickname }));
    return [{ value: "", label: "No location selected" }, ...opts];
  }, [locations]);

  const canCreate = Boolean(me && can(me.role, "VOTE_CREATE"));

  if (!me) return null;

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

  const guessNameFromUrl = (raw: string) => {
    const text = raw.trim();
    if (!text) return "document";
    try {
      const u = new URL(text);
      const last = u.pathname.split("/").filter(Boolean).pop();
      if (last) return decodeURIComponent(last);
      return u.hostname || "document";
    } catch {
      const parts = text.split("?")[0].split("#")[0].split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      return last || "document";
    }
  };

  if (!canCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not allowed</CardTitle>
          <CardSubtle>You don’t have permission to create votes.</CardSubtle>
        </CardHeader>
        <CardBody>
          <Pill tone="slate">Role: {me.role ? ROLE_LABEL[me.role] : "None"}</Pill>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Create vote</div>
        <div className="text-sm text-slate-600">Documents are immutable once attached (delete the whole vote to remove).</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardSubtle>Mobile-first form, saved into localStorage</CardSubtle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Field label="Type">
            <Select value={type} onChange={(v) => setType(v as VoteType)} options={TYPE_OPTIONS} />
          </Field>

          {type === "QUOTE" ? (
            <Field label="Invoice/Quote amount (optional)" hint={`Auto-approval threshold: $${settings.autoApprovalThresholdAmount} (set in Admin)`}>
              <Input value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="250" inputMode="numeric" />
            </Field>
          ) : null}

          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Approve invoice for pool pump repair" />
          </Field>

          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add context, supplier, impacts, and any constraints." />
          </Field>

          <Field label="Deadline (optional)" hint="Not strictly enforced in this version (display only).">
            <Input value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} type="datetime-local" />
          </Field>

          <Divider />

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Location</div>
            <Field label="Select saved location">
              <Select value={locationId} onChange={setLocationId} options={locationOptions} />
            </Field>
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">Or add a new location</div>
              <div className="mt-3 grid gap-3">
                <Field label="Nickname">
                  <Input value={newLocationNickname} onChange={(e) => setNewLocationNickname(e.target.value)} placeholder="Example: Meeting Room" />
                </Field>
                <Field label="Address (optional)">
                  <Input value={newLocationAddress} onChange={(e) => setNewLocationAddress(e.target.value)} placeholder="Example: Level 1, near foyer" />
                </Field>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const newId = actions.locations.upsertLocation(newLocationNickname, newLocationAddress || undefined);
                    if (newId) setLocationId(newId);
                    setNewLocationNickname("");
                    setNewLocationAddress("");
                  }}
                >
                  Save location
                </Button>
              </div>
            </div>
          </div>

          <Divider />

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Attachments (documents)</div>
            <Field label="Upload files (recommended for testing)" hint={`Files are stored in your browser for testing. Keep files under ${formatBytes(maxBytes)}.`}>
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
                    setAttachError(null);
                    for (const f of files) {
                      if (f.size > maxBytes) {
                        setAttachError(`"${f.name}" is too large. Keep documents under ${formatBytes(maxBytes)} for local testing.`);
                        continue;
                      }
                      const dataUrl = await readFileAsDataUrl(f);
                      setAttachments((prev) => [{ name: f.name, mimeType: f.type, size: f.size, dataUrl }, ...prev]);
                    }
                  }}
                />
                {attachError ? <div className="text-sm font-semibold text-rose-700">{attachError}</div> : null}
              </div>
            </Field>

            <div className="text-xs font-semibold text-slate-600">Or attach a link</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} placeholder="File name (e.g., invoice.pdf)" />
              <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="URL (optional)" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const name = attachmentName.trim();
                  const url = attachmentUrl.trim() || undefined;
                  const finalName = name || (url ? guessNameFromUrl(url) : "");
                  if (!finalName) return;
                  setAttachments((prev) => [{ name: finalName, url }, ...prev]);
                  setAttachmentName("");
                  setAttachmentUrl("");
                  setAttachError(null);
                }}
              >
                Add attachment
              </Button>
              <Button variant="ghost" onClick={() => setAttachments([])}>
                Clear
              </Button>
            </div>
            <div className="space-y-2">
              {attachments.length === 0 ? <div className="text-sm text-slate-600">No attachments yet.</div> : null}
              {attachments.map((a, idx) => (
                <div key={`${a.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{a.name}</div>
                    <div className="truncate text-xs text-slate-600">
                      {a.url ?? [formatBytes(a.size), a.mimeType].filter(Boolean).join(" • ") || "—"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          <Field label="Vote options" hint="One per line. Defaults to Approve/Deny/Abstain.">
            <Textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Approve\nDeny\nAbstain" />
          </Field>

          <Field label="Minimum quorum (optional)">
            <Input value={minimumQuorum} onChange={(e) => setMinimumQuorum(e.target.value)} placeholder="Example: 3" inputMode="numeric" />
          </Field>

          <Field label="Private notes (creator only)">
            <Textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} placeholder="Internal notes not shown to lot owners (future rule)." />
          </Field>

          <Divider />

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Visibility</div>
            <Checkbox
              checked={allowLotOwnersToViewOutcome}
              onChange={setAllowLotOwnersToViewOutcome}
              label="Allow lot owners to view outcome when closed (creator/BCM can toggle)"
            />
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-900">Exclude users</div>
              <div className="mt-2 text-xs text-slate-600">Excluded users won’t see this vote in lists or detail pages.</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {users
                  .slice()
                  .sort((a, b) => a.email.localeCompare(b.email))
                  .map((u) => (
                    <Checkbox
                      key={u.id}
                      checked={excludedUserIds.includes(u.id)}
                      onChange={(checked) => {
                        setExcludedUserIds((prev) => (checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)));
                      }}
                      label={u.email}
                    />
                  ))}
              </div>
            </div>
          </div>

          <Divider />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="secondary" onClick={() => router.push("/votes")}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
                const quorum = minimumQuorum.trim() ? Number(minimumQuorum) : undefined;
                const quote = quoteAmount.trim() ? Number(quoteAmount) : undefined;

                const newVoteId = actions.votes.createVote({
                  type,
                  title,
                  description,
                  deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : undefined,
                  locationId: locationId || undefined,
                  locationText: undefined,
                  attachments,
                  options,
                  minimumQuorum: typeof quorum === "number" && Number.isFinite(quorum) ? quorum : undefined,
                  privateNotes,
                  excludedUserIds,
                  allowLotOwnersToViewOutcome,
                  quoteAmount: typeof quote === "number" && Number.isFinite(quote) ? quote : undefined
                });

                if (newVoteId) router.push(`/votes/${newVoteId}`);
              }}
            >
              Create vote
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
