"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/error-report";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? error.name);
    reportClientError("boundary", error, error.digest ?? null);
  }, [error]);
  return (
    <ErrorState
      title="We couldn't load this page"
      description="Check your connection and try again. If the problem continues, please contact support."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
