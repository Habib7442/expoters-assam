import Link from "next/link";
import { Crown } from "lucide-react";

import type { MyPlan } from "@/lib/supabase/queries/my-plan";
import { Button } from "@/components/ui/button";

const PLAN_NAMES: Record<MyPlan["tier"], string> = { basic: "Basic (Free)", silver: "Silver", gold: "Gold" };

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Kolkata" };

function contactsLine(plan: MyPlan): string {
  const { quota, used, remaining } = plan.contacts;
  if (quota === null) return `Unlimited buyer contacts (${used} used this plan year).`;
  return `${used} of ${quota} buyer contact${quota === 1 ? "" : "s"} used this year, ${remaining} left.`;
}

/** The supplier's current membership plan, with an upgrade link (spec 0008). */
export function MyPlanCard({ plan }: { plan: MyPlan }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green/20 bg-background p-4 text-sm shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-wash text-green-deep">
          <Crown className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-green-deep">Your plan: {PLAN_NAMES[plan.tier]}</span>
          <span className="text-muted-foreground">
            {plan.tier === "basic"
              ? "Every account starts on the free Basic plan."
              : plan.expiresAt
                ? `Active until ${new Date(plan.expiresAt).toLocaleDateString("en-US", DATE_OPTIONS)}.`
                : "Active."}{" "}
            {contactsLine(plan)}
          </span>
        </div>
      </div>
      {plan.tier !== "gold" && (
        <Button
          variant="outline"
          className="rounded-full border-green text-green hover:bg-green/10"
          render={<Link href="/membership" />}
          nativeButton={false}
        >
          Upgrade plan
        </Button>
      )}
    </div>
  );
}
