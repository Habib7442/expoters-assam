type CategoryTileProps = {
  name: string;
  count: number;
};

export function CategoryTile({ name, count }: CategoryTileProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-background px-4 py-6 text-center shadow-sm">
      <span className="font-heading text-sm font-semibold text-green-deep sm:text-base">{name}</span>
      <span className="text-xs text-muted-foreground">
        {count} {count === 1 ? "product" : "products"}
      </span>
    </div>
  );
}
