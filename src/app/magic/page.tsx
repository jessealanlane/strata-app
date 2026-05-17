"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardTitle, Container } from "@/components/ui";
import { actions, useCurrentUser } from "@/lib/store";

function MagicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const me = useCurrentUser();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    // Simple mock: just mark as success and redirect (since real token login isn't implemented yet)
    setStatus("success");
    setTimeout(() => {
      router.replace("/");
    }, 1200);
  }, [token, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Verifying magic link...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-50">
      <Container>
        <div className="flex min-h-screen items-center justify-center py-10">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {status === "success" ? "✅ Login Successful" : "❌ Invalid Link"}
              </CardTitle>
            </CardHeader>
            <CardBody className="text-center">
              {status === "success" ? (
                <div>Redirecting you now...</div>
              ) : (
                <div>Invalid or expired magic link.</div>
              )}
            </CardBody>
          </Card>
        </div>
      </Container>
    </div>
  );
}

export default function Magic() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading magic link...</div>}>
      <MagicPage />
    </Suspense>
  );
}