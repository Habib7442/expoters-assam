"use client"

import { type FormEvent, type KeyboardEvent, useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Search } from "lucide-react"

import type { SearchSuggestion } from "@/app/api/search/suggest/route"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const SEARCH_SCOPES = [
  { label: "Products", value: "products", href: "/products" },
  { label: "Companies", value: "companies", href: "/companies" },
  { label: "Buy Leads", value: "buy-requirements", href: "/buy-requirements" },
] as const

const SUGGEST_DEBOUNCE_MS = 200
const MIN_SUGGEST_LENGTH = 2

type SuggestionResults = { key: string; items: SearchSuggestion[] }

export function HeroSearch() {
  const router = useRouter()
  const listboxId = useId()
  const [scope, setScope] = useState<(typeof SEARCH_SCOPES)[number]>(SEARCH_SCOPES[0])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SuggestionResults | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = query.trim()
  const requestKey = `${scope.value}:${trimmed}`
  // Only suggestions fetched for exactly what's in the box now are shown, so
  // a slow response for an older keystroke never flashes stale results.
  const suggestions = results?.key === requestKey ? results.items : []
  const showSuggestions = open && trimmed.length >= MIN_SUGGEST_LENGTH && suggestions.length > 0

  useEffect(() => {
    if (trimmed.length < MIN_SUGGEST_LENGTH) return

    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ scope: scope.value, q: trimmed })
        const response = await fetch(`/api/search/suggest?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const body = (await response.json()) as { suggestions: SearchSuggestion[] }
        setResults({ key: requestKey, items: body.suggestions })
        setActiveIndex(-1)
      } catch {
        // Aborted by a newer keystroke, or offline: suggestions are a
        // convenience, the Search button still works without them.
      }
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [trimmed, scope.value, requestKey])

  // An empty query still navigates: "Search" with nothing typed reads as
  // "browse this section", and every destination page already shows its
  // full list when there's no `q`.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const active = showSuggestions ? suggestions[activeIndex] : undefined
    if (active) {
      router.push(active.href)
      return
    }
    router.push(trimmed ? `${scope.href}?q=${encodeURIComponent(trimmed)}` : scope.href)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!showSuggestions) {
      if (event.key === "ArrowDown") setOpen(true)
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    }
  }

  return (
    <div className="relative w-full max-w-lg min-w-0">
      <form
        onSubmit={handleSubmit}
        role="search"
        className="flex w-full items-center rounded-full border border-border bg-background p-1 shadow-sm min-w-0"
      >
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 rounded-l-full border-r border-border px-2.5 py-2 text-xs font-medium text-muted-foreground outline-none hover:text-foreground sm:px-4 sm:py-2.5 sm:text-sm">
            {scope.label}
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SEARCH_SCOPES.map((option) => (
              <DropdownMenuItem key={option.label} onClick={() => setScope(option)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label={`Search ${scope.label.toLowerCase()}`}
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listboxId}
          aria-activedescendant={
            showSuggestions && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          placeholder={`Search ${scope.label.toLowerCase()}...`}
          className="h-8 min-w-0 flex-1 border-0 px-2 text-xs shadow-none focus-visible:ring-0 sm:h-9 sm:px-3 sm:text-sm"
        />
        <Button
          type="submit"
          className="h-8 shrink-0 rounded-full px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
          aria-label="Search"
        >
          <Search className="size-3.5 sm:size-4" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      <ul
        id={listboxId}
        role="listbox"
        aria-label={`${scope.label} suggestions`}
        hidden={!showSuggestions}
        className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover py-1 text-left text-popover-foreground shadow-lg"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.href}
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // mousedown, not click: it fires before the input's blur closes the list.
            onMouseDown={(event) => {
              event.preventDefault()
              router.push(suggestion.href)
            }}
            onMouseEnter={() => setActiveIndex(index)}
            className={cn(
              "flex cursor-pointer flex-col px-4 py-2 text-sm",
              index === activeIndex && "bg-accent text-accent-foreground",
            )}
          >
            <span className="truncate font-medium">{suggestion.label}</span>
            {suggestion.detail && (
              <span className="truncate text-xs text-muted-foreground">{suggestion.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
