import Link from "next/link";
import { Clock, MapPin, Package, ArrowRight } from "lucide-react";

type BuyRequirementCardProps = {
  productText: string;
  quantity: string;
  location: string | null;
  createdAt: string;
};

export function BuyRequirementCard({
  productText,
  quantity,
  location,
  createdAt,
}: BuyRequirementCardProps) {
  const postedOn = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
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

      {/* This starts a *new* buyer requirement, prefilled with this one's
          product. There is no supplier-to-buyer quote flow (buyer contact
          details are private by design), so the label says what actually
          happens rather than implying the visitor is quoting this lead. */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">Assam Trade Enquiry</span>
        <Link
          href={`/buy-requirements/new?product=${encodeURIComponent(productText)}`}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-green transition-colors hover:text-green-deep"
        >
          <span>Post similar requirement</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
