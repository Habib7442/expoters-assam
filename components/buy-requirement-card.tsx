import Link from "next/link";
import { Clock, MapPin, Package, ArrowRight } from "lucide-react";

import { SendEnquiryDialog } from "@/components/send-enquiry-dialog";

type BuyRequirementCardProps = {
  id: string;
  productText: string;
  quantity: string;
  location: string | null;
  createdAt: string;
};

export function BuyRequirementCard({
  id,
  productText,
  quantity,
  location,
  createdAt,
}: BuyRequirementCardProps) {
  const postedOn = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    // The directory is India based; pin the zone so a requirement posted
    // just after midnight IST isn't dated the day before on a UTC server.
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition-all hover:border-green/40 hover:shadow-sm">
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3 text-muted-foreground/70" />
          Posted {postedOn}
        </span>

        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-wash text-green-deep">
            <Package className="size-4" />
          </span>
          <div className="flex flex-col min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground group-hover:text-green-deep transition-colors line-clamp-2">
              {productText}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="inline-flex items-center rounded-lg bg-bg-soft px-2.5 py-1 font-medium text-green-deep border border-border/80">
            Required: <strong className="ml-1 font-semibold">{quantity}</strong>
          </span>
          {location && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2.5 py-1 text-muted-foreground border border-border/60">
              <MapPin className="size-3 text-muted-foreground/80 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>
      </div>

      {/* "Respond" sends a supplier's reply to the platform team, who
          introduce the two sides (feature 9); the buyer's contact details
          stay private. "Post similar" starts a *new* requirement, prefilled
          with this one's product. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 pt-3 text-xs">
        <SendEnquiryDialog
          target={{ type: "buy_requirement", buyRequirementId: id, productText }}
          triggerLabel="Respond"
          triggerSize="sm"
          triggerClassName="rounded-full px-4"
        />
        <Link
          href={`/buy-requirements/new?product=${encodeURIComponent(productText)}`}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-green transition-colors hover:text-green-deep"
        >
          <span>Post similar</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
