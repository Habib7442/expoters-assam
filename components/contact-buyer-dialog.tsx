"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";

import {
  getBuyerContactStatus,
  unlockBuyerContact,
  type BuyerContactStatus,
} from "@/lib/actions/buyer-contact";
import type { ContactAllowance } from "@/lib/supabase/queries/buyer-contacts";
import { BuyerContactDetails } from "@/components/buyer-contact-details";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ContactBuyerDialogProps = {
  buyRequirementId: string;
  productText: string;
};

const TIER_NAMES: Record<ContactAllowance["tier"], string> = { basic: "Basic", silver: "Silver", gold: "Gold" };

function allowanceText(allowance: ContactAllowance): string {
  if (allowance.quota === null) return `Unlimited buyer contacts on your ${TIER_NAMES[allowance.tier]} plan.`;
  return `${allowance.remaining} of ${allowance.quota} buyer contact${allowance.quota === 1 ? "" : "s"} left this year on your ${TIER_NAMES[allowance.tier]} plan.`;
}

/**
 * IndiaMART style "Contact Buyer" (spec 0009): opening it checks, without
 * using anything, whether the supplier can see this buyer; confirming
 * unlocks the buyer's name, phone and email and uses one buyer contact.
 */
export function ContactBuyerDialog({ buyRequirementId, productText }: ContactBuyerDialogProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<BuyerContactStatus | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [unlocking, startUnlocking] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setUnlockError(null);
    if (next) {
      setStatus(null);
      startLoading(async () => setStatus(await getBuyerContactStatus(buyRequirementId)));
    }
  }

  function handleUnlock() {
    setUnlockError(null);
    startUnlocking(async () => {
      const result = await unlockBuyerContact(buyRequirementId);
      if (result.ok) {
        setStatus({ kind: "unlocked", contact: result.contact, allowance: result.allowance });
      } else if (result.code === "quota_exhausted" && status?.kind === "can_unlock") {
        setStatus({ kind: "exhausted", allowance: { ...status.allowance, remaining: 0 } });
      } else {
        setUnlockError(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" className="rounded-full px-4" />}>Contact Buyer</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact this buyer</DialogTitle>
          <DialogDescription className="line-clamp-2">{productText}</DialogDescription>
        </DialogHeader>

        {(loading || !status) && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        )}

        {!loading && status && <StatusBody status={status} returnPath={pathname} unlocking={unlocking} unlockError={unlockError} onUnlock={handleUnlock} />}
      </DialogContent>
    </Dialog>
  );
}

type StatusBodyProps = {
  status: BuyerContactStatus;
  /** The page the dialog was opened on, so sign in returns the supplier there. */
  returnPath: string;
  unlocking: boolean;
  unlockError: string | null;
  onUnlock: () => void;
};

function StatusBody({ status, returnPath, unlocking, unlockError, onUnlock }: StatusBodyProps) {
  switch (status.kind) {
    case "signed_out":
      return (
        <Notice text="Sign in with your supplier account to see this buyer's contact details.">
          <Button className="w-full rounded-full" render={<Link href={`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`} />} nativeButton={false}>
            Sign in
          </Button>
        </Notice>
      );
    case "no_company":
      return (
        <Notice text="List your business for free to contact buyers. Every approved business gets 1 buyer contact a year on the Basic plan.">
          <Button className="w-full rounded-full" render={<Link href="/list-business" />} nativeButton={false}>
            List Your Business Free
          </Button>
        </Notice>
      );
    case "not_approved":
      return <Notice text="Your business listing is still waiting for approval. You can contact buyers once it's live." />;
    case "not_found":
      return <Notice text="This buy requirement is no longer available." />;
    case "not_unlockable":
      return <Notice text="This buyer posted before contact sharing was available, so their details can't be shown. Use Respond on the requirement and our team will introduce you." />;
    case "error":
      return <Notice text={status.message} />;
    case "exhausted":
      return (
        <Notice text={`You've used all ${status.allowance.quota} of your buyer contacts for this plan year. Upgrade to contact more buyers.`}>
          <Button className="w-full rounded-full" render={<Link href="/membership" />} nativeButton={false}>
            See membership plans
          </Button>
        </Notice>
      );
    case "unlocked":
      return (
        <div className="flex flex-col gap-3">
          <BuyerContactDetails contact={status.contact} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {status.allowance && <span>{allowanceText(status.allowance)}</span>}
            <Link href="/my-buyer-contacts" className="font-semibold text-green hover:text-green-deep">
              My buyer contacts
            </Link>
          </div>
        </div>
      );
    case "can_unlock":
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-bg-soft p-4 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-green" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">See the buyer&apos;s name, phone and email</span>
              <span className="text-muted-foreground">
                {status.allowance.quota === null
                  ? "This doesn't use anything on your Gold plan."
                  : "This uses 1 buyer contact. Opening this buyer again later is free."}
              </span>
              <span className="text-muted-foreground">{allowanceText(status.allowance)}</span>
            </div>
          </div>
          {unlockError && (
            <p role="alert" className="text-sm text-destructive">
              {unlockError}
            </p>
          )}
          <Button size="lg" className="w-full rounded-full" disabled={unlocking} onClick={onUnlock}>
            {unlocking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {status.allowance.quota === null ? "Show contact details" : "Use 1 contact and show details"}
          </Button>
        </div>
      );
  }
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
