import Image from "next/image";

type CategoryTileProps = {
  name: string;
  count: number;
  imageUrl: string | null;
};

export function CategoryTile({ name, count, imageUrl }: CategoryTileProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-6 text-center shadow-sm">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          width={48}
          height={48}
          className="size-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-full bg-green-wash text-lg font-semibold text-green-deep">
          {name.slice(0, 1)}
        </div>
      )}
      <span className="font-heading text-sm font-semibold text-green-deep sm:text-base">{name}</span>
      <span className="text-xs text-muted-foreground">
        {count} {count === 1 ? "product" : "products"}
      </span>
    </div>
  );
}
