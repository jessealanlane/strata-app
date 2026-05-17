"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button, Modal, Select } from "@/components/ui";
import { actions, useCurrentUser } from "@/lib/store";
import type { Role } from "@/lib/model";
import { ROLE_LABEL } from "@/lib/model";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "BCM_BCMA", label: ROLE_LABEL.BCM_BCMA },
  { value: "BCC", label: ROLE_LABEL.BCC },
  { value: "BCCA", label: ROLE_LABEL.BCCA },
  { value: "COMMITTEE_MEMBER", label: ROLE_LABEL.COMMITTEE_MEMBER },
  { value: "BUILDING_MANAGER", label: ROLE_LABEL.BUILDING_MANAGER },
  { value: "LOT_OWNER", label: ROLE_LABEL.LOT_OWNER }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useCurrentUser();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<Role>("COMMITTEE_MEMBER");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [mounted, me, router, pathname]);

  useEffect(() => {
    if (me?.role) setRole(me.role);
  }, [me?.role]);

  const mustPickRole = Boolean(me && !me.role);
  const roleOptions = useMemo(() => ROLE_OPTIONS, []);

  if (!mounted) return <div className="min-h-screen bg-slate-50" />;
  if (!me) return <div className="min-h-screen bg-slate-50" />;

  return (
    <AppShell>
      {children}
      <Modal
        open={mustPickRole}
        onClose={() => {}}
        title="Select a role (test mode)"
        footer={
          <Button
            onClick={() => {
              actions.auth.setCurrentUserRole(role);
              actions.auth.setCurrentUserApproved(false);
            }}
          >
            Continue
          </Button>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div>
            This first version uses mock authentication and localStorage. In production, role assignment will be domain-based + admin approval.
          </div>
          <Select
            value={role}
            onChange={(v) => setRole(v as Role)}
            options={roleOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
      </Modal>
    </AppShell>
  );
}
