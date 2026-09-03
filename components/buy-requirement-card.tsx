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
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-5 shadow-sm">
      <span className="font-heading text-sm font-semibold text-green-deep">{productText}</span>
      <span className="text-xs text-muted-foreground">Quantity: {quantity}</span>
      {location && <span className="text-xs text-muted-foreground">{location}</span>}
      <span className="text-xs text-muted-foreground/70">Posted {postedOn}</span>
    </div>
  );
}
