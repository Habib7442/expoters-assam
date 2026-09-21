import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type LoadFailedStateProps = {
  /** What couldn't be loaded, lowercase, e.g. "companies" — fills "We couldn't load {what}". */
  what: string;
  /** Where "Try Again" goes: the current page's own URL, so filters survive the retry. */
  retryHref: string;
};

/**
 * Shown when a list query itself failed. Distinct on purpose from every
 * "no results" state: a database failure must never read as "the directory
 * is empty" (which would also invite the visitor to conclude nobody has
 * listed anything yet).
 */
export function LoadFailedState({ what, retryHref }: LoadFailedStateProps) {
  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-xs sm:p-12"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-7" />
      </div>
      <h3 className="mt-4 font-heading text-lg font-bold text-foreground sm:text-xl">
        We couldn&apos;t load {what}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Something went wrong on our end, so this list may not be complete. Please try again in a moment.
      </p>
      <div className="mt-6">
        <Button variant="outline" className="rounded-xl" render={<Link href={retryHref} />} nativeButton={false}>
          <RefreshCw className="mr-1.5 size-4" />
          Try Again
        </Button>
      </div>
    </section>
  );
}
