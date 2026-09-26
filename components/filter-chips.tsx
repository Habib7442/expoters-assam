import Link from "next/link";

import { Badge } from "@/components/ui/badge";

type FilterChipsProps = {
  /** The listing page these chips filter, e.g. "/products". */
  basePath: string;
  /** The query param this row controls, e.g. "category" or "country". */
  param: string;
  label: string;
  options: { value: string; label: string }[];
  active: string | undefined;
  /** Every other filter currently in the URL, kept when a chip is picked. */
  otherParams: Record<string, string | undefined>;
};

/** One row of filter chips whose links keep the page's other filters in the URL. */
export function FilterChips({ basePath, param, label, options, active, otherParams }: FilterChipsProps) {
  const hrefFor = (value: string | undefined) => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(otherParams)) if (v) params.set(key, v);
    if (value) params.set(param, value);
    return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
  };

  return (
    <nav aria-label={`Filter by ${label.toLowerCase()}`} className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}:</span>
      {/* The Badge renders as the link itself, so its hover and focus styles apply to what gets focused. */}
      <Badge
        render={<Link href={hrefFor(undefined)} aria-current={!active ? "true" : undefined} />}
        variant={!active ? "default" : "secondary"}
        className="h-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
      >
        All
      </Badge>
      {options.map((option) => (
        <Badge
          key={option.value}
          render={<Link href={hrefFor(option.value)} aria-current={active === option.value ? "true" : undefined} />}
          variant={active === option.value ? "default" : "secondary"}
          className="h-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-medium"
        >
          {option.label}
        </Badge>
      ))}
    </nav>
  );
}
