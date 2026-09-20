import Link from "next/link";
import { Clock, MapPin, Package, ShieldCheck, ArrowRight } from "lucide-react";

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
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200/70">
            <ShieldCheck className="size-3 text-emerald-600" />
            Verified Buy Lead
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 text-muted-foreground/70" />
            {postedOn}
          </span>
        </div>

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

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
        <span className="text-[11px] text-muted-foreground">Assam Trade Enquiry</span>
        <Link
          href={`/buy-requirements/new?product=${encodeURIComponent(productText)}`}
          className="inline-flex items-center gap-1 font-semibold text-green hover:text-green-deep transition-colors group-hover:translate-x-0.5"
        >
          <span>Quote Lead</span>
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
