import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type ExporterCardProps = {
  slug: string;
  name: string;
  logoUrl: string | null;
  location: string;
  verified: boolean;
};

export function ExporterCard({ slug, name, logoUrl, location, verified }: ExporterCardProps) {
  return (
    <Link
      href={`/companies/${slug}`}
      className="flex w-full min-w-0 flex-col items-center gap-3 rounded-2xl border border-border bg-background p-5 text-center shadow-sm transition-shadow hover:shadow-md"
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green-wash text-lg font-semibold text-green-deep">
          {name.slice(0, 1)}
        </div>
      )}
      <div className="flex w-full min-w-0 flex-col items-center gap-1">
        <span className="w-full text-sm font-semibold text-green-deep">{name}</span>
        <span className="w-full truncate text-xs text-muted-foreground">{location}</span>
      </div>
      {verified && (
        <Badge className="h-auto gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
          <BadgeCheck className="size-3" aria-hidden="true" />
          Verified
        </Badge>
      )}
    </Link>
  );
}
