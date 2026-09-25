import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  slug: string;
  name: string;
  /** `null` when the stored image isn't on our image host (see isR2Url); the card shows a letter placeholder instead. */
  imageUrl: string | null;
  /** Omit on a page that's already about one company, where repeating it on every card is noise. */
  companyName?: string;
  categoryName?: string | null;
};

export function ProductCard({ slug, name, imageUrl, companyName, categoryName }: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-green/40 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-bg-soft">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={360}
            height={360}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-green-wash font-heading text-4xl font-bold text-green-deep"
          >
            {name.slice(0, 1)}
          </div>
        )}
        {categoryName && (
          <span className="absolute top-2.5 left-2.5 rounded-full border border-border/60 bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-green-deep shadow-xs backdrop-blur-xs">
            {categoryName}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="line-clamp-2 font-heading text-sm font-semibold text-foreground transition-colors group-hover:text-green-deep">
          {name}
        </span>
        {companyName && <span className="truncate text-xs text-muted-foreground">by {companyName}</span>}
      </div>
    </Link>
  );
}
