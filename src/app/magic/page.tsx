"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardSubtle, CardTitle, Container } from "@/components/ui";
import { actions } from "@/lib/store";

export default function MagicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    if (!token) {
      setStatus("fail");
      return;
    }
    const ok = actions.auth.consumeMagicLink(token);
    setStatus(ok ? "ok" : "fail");
    if (ok) router.replace("/");
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Container>
        <div className="flex min-h-screen items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Magic link</CardTitle>
                <CardSubtle>Mock sign-in (localStorage)</CardSubtle>
              </CardHeader>
              <CardBody className="space-y-3">
                {status === "idle" ? <div className="text-sm text-slate-700">Signing you in…</div> : null}
                {status === "ok" ? <div className="text-sm text-slate-700">Signed in. Redirecting…</div> : null}
                {status === "fail" ? (
                  <div className="space-y-3">
                    <div className="text-sm text-rose-700">This magic link is invalid or expired.</div>
                    <Button onClick={() => router.replace("/login")}>Back to login</Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

