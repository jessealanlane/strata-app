"use client";

import { useMemo, useState } from "react";
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
  Input,
  Modal,
  Pill,
  Select,
  Tabs
} from "@/components/ui";
import { actions, useAppStore, useCurrentUser } from "@/lib/store";
import type { Role } from "@/lib/model";
import { ROLE_LABEL, can } from "@/lib/model";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "BCM_BCMA", label: ROLE_LABEL.BCM_BCMA },
  { value: "BCC", label: ROLE_LABEL.BCC },
  { value: "BCCA", label: ROLE_LABEL.BCCA },
  { value: "COMMITTEE_MEMBER", label: ROLE_LABEL.COMMITTEE_MEMBER },
  { value: "BUILDING_MANAGER", label: ROLE_LABEL.BUILDING_MANAGER },
  { value: "LOT_OWNER", label: ROLE_LABEL.LOT_OWNER }
];

export default function AdminPage() {
  const me = useCurrentUser();
  const users = useAppStore((s) => s.users);
  const lots = useAppStore((s) => s.lots);
  const settings = useAppStore((s) => s.settings);

  const [tab, setTab] = useState<"users" | "lots" | "settings">("users");

  const [bulkStart, setBulkStart] = useState("1");
  const [bulkEnd, setBulkEnd] = useState("250");

  const [renameLotId, setRenameLotId] = useState<string>("");
  const [renameLotName, setRenameLotName] = useState<string>("");

  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");

  const [threshold, setThreshold] = useState(String(settings.autoApprovalThresholdAmount));

  const [assignUserId, setAssignUserId] = useState<string | undefined>();
  const [lotSearch, setLotSearch] = useState("");

  const sortedUsers = useMemo(() => users.slice().sort((a, b) => a.email.localeCompare(b.email)), [users]);
  const pendingUsers = useMemo(() => sortedUsers.filter((u) => u.role && !u.approved), [sortedUsers]);

  const sortedLots = useMemo(
    () => lots.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [lots]
  );

  const lotOptions = useMemo(() => sortedLots.map((l) => ({ value: l.id, label: l.name })), [sortedLots]);

  const assignUser = users.find((u) => u.id === assignUserId);
  const filteredLots = useMemo(() => {
    const q = lotSearch.trim().toLowerCase();
    if (!q) return sortedLots;
    return sortedLots.filter((l) => l.name.toLowerCase().includes(q));
  }, [sortedLots, lotSearch]);

  if (!me) return null;

  if (!can(me.role, "ADMIN_VIEW")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardSubtle>Only {ROLE_LABEL.BCM_BCMA} can access this page.</CardSubtle>
        </CardHeader>
        <CardBody>
          <Pill tone="slate">Role: {me.role ? ROLE_LABEL[me.role] : "None"}</Pill>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">Admin</div>
          <div className="text-sm text-slate-600">Approve users, manage lots, and configure settings.</div>
        </div>
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          items={[
            { value: "users", label: "Users", right: pendingUsers.length ? <Pill tone="red">{pendingUsers.length}</Pill> : <Pill tone="slate">0</Pill> },
            { value: "lots", label: "Lots", right: <Pill tone="slate">{sortedLots.length}</Pill> },
            { value: "settings", label: "Settings", right: <Pill tone="slate">1</Pill> }
          ]}
        />
      </div>

      {tab === "users" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
              <CardSubtle>Users who selected a role but aren’t approved yet.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-2">
              {pendingUsers.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No pending users.</div>
              ) : (
                pendingUsers.map((u) => (
                  <div key={u.id} className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{u.email}</div>
                      <div className="text-xs text-slate-600">{u.role ? ROLE_LABEL[u.role] : "Role not set"}</div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button variant="secondary" size="sm" onClick={() => setAssignUserId(u.id)}>
                        Assign lots
                      </Button>
                      <Button size="sm" onClick={() => actions.users.approveUser(u.id, true)}>
                        Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All users</CardTitle>
              <CardSubtle>Assign roles and manage approvals.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-2">
              {sortedUsers.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No users yet.</div>
              ) : (
                sortedUsers.map((u) => (
                  <div key={u.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{u.email}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {u.approved ? <Pill tone="green">Approved</Pill> : <Pill tone="red">Pending</Pill>}
                          {u.role ? <Pill tone="slate">{ROLE_LABEL[u.role]}</Pill> : <Pill tone="slate">No role</Pill>}
                          {u.lotIds.length ? <Pill tone="blue">{u.lotIds.length} lots</Pill> : <Pill tone="slate">No lots</Pill>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button variant="secondary" size="sm" onClick={() => setAssignUserId(u.id)}>
                          Assign lots
                        </Button>
                        <Button variant={u.approved ? "secondary" : "primary"} size="sm" onClick={() => actions.users.approveUser(u.id, !u.approved)}>
                          {u.approved ? "Unapprove" : "Approve"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Role">
                        <Select
                          value={u.role ?? ""}
                          onChange={(v) => {
                            if (!v) return;
                            actions.users.setUserRole(u.id, v as Role);
                          }}
                          placeholder="Select role"
                          options={ROLE_OPTIONS}
                        />
                      </Field>
                      <Field label="Lots (summary)">
                        <Input
                          value={u.lotIds.map((id) => lots.find((l) => l.id === id)?.name ?? id).join(", ")}
                          readOnly
                        />
                      </Field>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "lots" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bulk create lots</CardTitle>
              <CardSubtle>Create Lot 1–250 (or any range). Duplicate names are skipped.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start">
                  <Input value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="End">
                  <Input value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} inputMode="numeric" />
                </Field>
              </div>
              <Button
                onClick={() => {
                  actions.admin.bulkCreateLots(Number(bulkStart), Number(bulkEnd));
                }}
              >
                Create lots
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rename lot</CardTitle>
              <CardSubtle>Simple edit support for early testing.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Lot">
                <Select value={renameLotId} onChange={setRenameLotId} placeholder="Select lot" options={lotOptions} />
              </Field>
              <Field label="New name">
                <Input value={renameLotName} onChange={(e) => setRenameLotName(e.target.value)} placeholder="Lot 12A" />
              </Field>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!renameLotId) return;
                  actions.admin.renameLot(renameLotId, renameLotName);
                  setRenameLotName("");
                }}
              >
                Rename
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Merge lots</CardTitle>
              <CardSubtle>Moves all user assignments from one lot into another, then deletes the source lot.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From">
                  <Select value={mergeFrom} onChange={setMergeFrom} placeholder="Source lot" options={lotOptions} />
                </Field>
                <Field label="To">
                  <Select value={mergeTo} onChange={setMergeTo} placeholder="Target lot" options={lotOptions} />
                </Field>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  actions.admin.mergeLots(mergeFrom, mergeTo);
                  setMergeFrom("");
                  setMergeTo("");
                }}
              >
                Merge
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lots</CardTitle>
              <CardSubtle>Remove lots (user assignments are cleaned up).</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-2">
              {sortedLots.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">No lots yet.</div>
              ) : (
                sortedLots.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="truncate text-sm font-semibold text-slate-900">{l.name}</div>
                    <Button variant="ghost" size="sm" onClick={() => actions.admin.removeLot(l.id)}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-approval threshold</CardTitle>
              <CardSubtle>Building Manager quote invoices at or below this amount auto-close as approved.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Threshold amount (AUD)">
                <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" />
              </Field>
              <Button
                onClick={() => {
                  const v = Number.isFinite(Number(threshold)) ? Math.max(0, Math.round(Number(threshold))) : 0;
                  actions.admin.setAutoApprovalThresholdAmount(v);
                  setThreshold(String(v));
                }}
              >
                Save threshold
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global notification overrides</CardTitle>
              <CardSubtle>Admins can override a user’s notification preferences.</CardSubtle>
            </CardHeader>
            <CardBody className="space-y-2">
              {sortedUsers.map((u) => (
                <div key={u.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{u.email}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Pill tone="slate">{u.role ? ROLE_LABEL[u.role] : "No role"}</Pill>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => actions.admin.setNotificationOverrideForUser(u.id, {})}>
                      Reset
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Checkbox
                      checked={Boolean(settings.notificationOverridesByUserId[u.id]?.forceEnabled)}
                      onChange={(checked) => actions.admin.setNotificationOverrideForUser(u.id, { forceEnabled: checked })}
                      label="Force enabled"
                    />
                    <Checkbox
                      checked={settings.notificationOverridesByUserId[u.id]?.enabled ?? u.notificationPrefs.enabled}
                      onChange={(checked) => actions.admin.setNotificationOverrideForUser(u.id, { enabled: checked })}
                      label="Enabled"
                    />
                    <Checkbox
                      checked={settings.notificationOverridesByUserId[u.id]?.votes ?? u.notificationPrefs.votes}
                      onChange={(checked) => actions.admin.setNotificationOverrideForUser(u.id, { votes: checked })}
                      label="Votes"
                    />
                    <Checkbox
                      checked={settings.notificationOverridesByUserId[u.id]?.updates ?? u.notificationPrefs.updates}
                      onChange={(checked) => actions.admin.setNotificationOverrideForUser(u.id, { updates: checked })}
                      label="Updates"
                    />
                    <Checkbox
                      checked={settings.notificationOverridesByUserId[u.id]?.ideas ?? u.notificationPrefs.ideas}
                      onChange={(checked) => actions.admin.setNotificationOverrideForUser(u.id, { ideas: checked })}
                      label="Ideas"
                    />
                    <Checkbox
                      checked={settings.notificationOverridesByUserId[u.id]?.admin ?? u.notificationPrefs.admin}
                      onChange={(checked) => actions.admin.setNotificationOverrideForUser(u.id, { admin: checked })}
                      label="Admin"
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      ) : null}

      <Modal
        open={Boolean(assignUserId)}
        onClose={() => {
          setAssignUserId(undefined);
          setLotSearch("");
        }}
        title="Assign lots"
        footer={
          <Button
            onClick={() => {
              setAssignUserId(undefined);
              setLotSearch("");
            }}
          >
            Done
          </Button>
        }
      >
        {!assignUser ? (
          <div className="text-sm text-slate-700">User not found.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">{assignUser.email}</div>
            <Field label="Search lots">
              <Input value={lotSearch} onChange={(e) => setLotSearch(e.target.value)} placeholder="Lot 12" />
            </Field>
            <Divider />
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredLots.slice(0, 80).map((l) => (
                <Checkbox
                  key={l.id}
                  checked={assignUser.lotIds.includes(l.id)}
                  onChange={(checked) => {
                    const next = checked ? [...assignUser.lotIds, l.id] : assignUser.lotIds.filter((x) => x !== l.id);
                    actions.users.setUserLots(assignUser.id, next);
                  }}
                  label={l.name}
                />
              ))}
            </div>
            {filteredLots.length > 80 ? (
              <div className="text-xs text-slate-600">Showing first 80 matches. Refine your search to see more.</div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
