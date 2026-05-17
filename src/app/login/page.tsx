"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";                    // ← Added this
import { Button, Card, CardBody, CardHeader, CardSubtle, CardTitle, Container, Divider, Field, Input, Pill } from "@/components/ui";
import { actions, useCurrentUser } from "@/lib/store";
import type { Role } from "@/lib/model";
import { ROLE_LABEL } from "@/lib/model";

const QUICK_ROLES: Role[] = [
  "BCM_BCMA",
  "BCC",
  "BCCA",
  "COMMITTEE_MEMBER",
  "BUILDING_MANAGER",
  "LOT_OWNER"
];

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const me = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkToken, setMagicLinkToken] = useState<string | undefined>();

  useEffect(() => {
    if (me) router.replace(next);
  }, [me, router, next]);

  const roleButtons = useMemo(() => QUICK_ROLES, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-50">
      <Container>
        <div className="flex min-h-screen items-center justify-center py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <div className="text-3xl font-extrabold tracking-tight text-slate-900">StrataVote</div>
              <div className="mt-1 text-sm font-semibold text-brand-700">BCS Southport</div>
              <div className="mt-2 text-sm text-slate-600">Clean voting, updates, and notifications — mobile first.</div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardSubtle>Email/password or magic link (mock auth)</CardSubtle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="space-y-3">
                  <Field label="Email">
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" />
                  </Field>
                  <Field label="Password">
                    <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Any password works in test mode" type="password" />
                  </Field>
                  <Button
                    onClick={() => {
                      actions.auth.loginWithPassword(email, password);
                      router.replace(next);
                    }}
                  >
                    Sign in
                  </Button>
                </div>

                <Divider />

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Magic link</div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const token = actions.auth.sendMagicLink(email);
                        setMagicLinkToken(token);
                      }}
                    >
                      Send magic link
                    </Button>
                    {magicLinkToken ? (
                      <Link href={`/magic?token=${encodeURIComponent(magicLinkToken)}`} className="w-full sm:w-auto">
                        <span className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                          Open link
                        </span>
                      </Link>
                    ) : null}
                  </div>
                  {magicLinkToken ? (
                    <div className="text-xs text-slate-600">
                      Test token: <span className="font-mono">{magicLinkToken}</span>
                    </div>
                  ) : null}
                </div>

                <Divider />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Quick login (testing)</div>
                    <Pill tone="slate">Local only</Pill>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {roleButtons.map((r) => (
                      <Button
                        key={r}
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          actions.auth.quickLoginAsRole(r);
                          router.replace(next);
                        }}
                      >
                        {ROLE_LABEL[r]}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="text-center text-xs text-slate-500">
              Storage: localStorage + in-memory store. No external database required for this version.
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading login...</div>}>
      <LoginPage />
    </Suspense>
  );
}