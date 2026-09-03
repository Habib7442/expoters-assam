"use client";

import { Button } from "@/components/ui/button";

export default function ProductPageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg-soft px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-bold text-green-deep">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t load this product right now. Please try again.
      </p>
      <Button className="rounded-full" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
