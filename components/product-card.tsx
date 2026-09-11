import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  slug: string;
  name: string;
  imageUrl: string;
  companyName: string;
};

export function ProductCard({ slug, name, imageUrl, companyName }: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-bg-soft">
        <Image
          src={imageUrl}
          alt={name}
          width={320}
          height={320}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="truncate font-heading text-sm font-semibold text-green-deep">{name}</span>
        <span className="truncate text-xs text-muted-foreground">by {companyName}</span>
      </div>
    </Link>
  );
}
