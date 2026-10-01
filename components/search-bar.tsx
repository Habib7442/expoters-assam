"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type SearchBarProps = {
  /** URL query param this reads from and writes to. Defaults to "q". */
  paramName?: string
  placeholder?: string
  /** Debounce delay in ms before the URL (and the server query) updates. */
  debounceMs?: number
  className?: string
}

/**
 * A live, debounced, URL-driven search box: typing updates `?<paramName>=`
 * (via router.replace, no history entry per keystroke) after `debounceMs`
 * of no typing, which re-runs the page's server-side data fetch. Any other
 * query params on the URL (a category filter, etc.) are preserved.
 *
 * One component for every list page that needs search — drop it in with a
 * `paramName` if it's not "q", read `searchParams` server-side as usual.
 */
export function SearchBar({
  paramName = "q",
  placeholder = "Search...",
  debounceMs = 400,
  className,
}: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const serializedSearchParams = searchParams.toString()
  const urlValue = searchParams.get(paramName) ?? ""

  const [value, setValue] = useState(urlValue)
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue)
  // The last value this box itself sent to the URL.
  const [issuedValue, setIssuedValue] = useState<string | null>(null)
  // Pending from the URL update until the page's new results arrive: the
  // old list stays on screen meanwhile, so the icon turns into a spinner.
  const [isPending, startTransition] = useTransition()

  // Keeps the input in sync with external navigation (a category chip that
  // carries the current q along, browser back/forward) without fighting the
  // user's own typing: adjusted during render, not in an effect, per React's
  // "adjusting state when a prop changes" pattern — setState directly inside
  // an effect body causes an avoidable extra render. When the URL change is
  // this box's own search arriving, the text is left alone: the user may
  // have kept typing ("car" sent, "cart" typed since), and resetting it
  // would drop that draft and cancel its pending update.
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue)
    if (urlValue !== issuedValue) setValue(urlValue)
    setIssuedValue(null)
  }

  useEffect(() => {
    if (value === urlValue) return

    const handle = setTimeout(() => {
      const params = new URLSearchParams(serializedSearchParams)
      if (value) params.set(paramName, value)
      else params.delete(paramName)

      setIssuedValue(value)
      startTransition(() => {
        router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname)
      })
    }, debounceMs)

    return () => clearTimeout(handle)
  }, [value, urlValue, debounceMs, paramName, pathname, router, serializedSearchParams])

  return (
    <div className={cn("relative flex w-full max-w-md items-center", className)}>
      {isPending ? (
        <Loader2
          className="pointer-events-none absolute left-3 size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Search
          className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-busy={isPending}
        className="h-10 pl-9"
      />
    </div>
  )
}
