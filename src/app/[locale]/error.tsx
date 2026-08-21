"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side error boundary — server-side errors are already logged
    // by src/instrumentation.ts's onRequestError hook.
    console.error(JSON.stringify({ severity: "ERROR", message: error.message, digest: error.digest }));
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-16">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-xl font-bold text-text-primary">Something went wrong</h1>
          <p className="text-sm text-text-secondary">
            We hit an unexpected error. You can try again, or head back home.
          </p>
          <div className="flex gap-3">
            <Button onClick={reset} variant="primary" size="sm">
              Try again
            </Button>
            <Button href="/" variant="outline" size="sm">
              Go home
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
