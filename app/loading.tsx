import { Loader2 } from "lucide-react"

// Shown instantly between the header and footer while any page's data
// loads (a product, a company, a filtered list), so a slow page never looks
// like a click that did nothing.
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-bg-soft px-4 py-24">
      <div role="status" className="flex flex-col items-center gap-3 text-green-deep">
        <Loader2 className="size-8 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">Loading...</p>
      </div>
    </main>
  )
}
