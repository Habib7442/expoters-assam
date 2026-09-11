"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

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
  const [, startTransition] = useTransition()

  // Keeps the input in sync with external navigation (a category chip that
  // carries the current q along, browser back/forward) without fighting the
  // user's own typing: adjusted during render, not in an effect, per React's
  // "adjusting state when a prop changes" pattern — setState directly inside
  // an effect body causes an avoidable extra render.
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue)
    setValue(urlValue)
  }

  useEffect(() => {
    if (value === urlValue) return

    const handle = setTimeout(() => {
      const params = new URLSearchParams(serializedSearchParams)
      if (value) params.set(paramName, value)
      else params.delete(paramName)

      startTransition(() => {
        router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname)
      })
    }, debounceMs)

    return () => clearTimeout(handle)
  }, [value, urlValue, debounceMs, paramName, pathname, router, serializedSearchParams])

  return (
    <div className={cn("relative flex w-full max-w-md items-center", className)}>
      <Search
        className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 pl-9"
      />
    </div>
  )
}
