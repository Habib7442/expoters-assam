"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

const SEARCH_SCOPES = [
  { label: "Products", href: "/products" },
  { label: "Companies", href: "/companies" },
  { label: "Buy Leads", href: "/buy-requirements" },
] as const

export function HeroSearch() {
  const router = useRouter()
  const [scope, setScope] = useState<(typeof SEARCH_SCOPES)[number]>(SEARCH_SCOPES[0])
  const [query, setQuery] = useState("")

  // An empty query still navigates: "Search" with nothing typed reads as
  // "browse this section", and every destination page already shows its
  // full list when there's no `q`.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    router.push(trimmed ? `${scope.href}?q=${encodeURIComponent(trimmed)}` : scope.href)
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex w-full max-w-lg items-center rounded-full border border-border bg-background p-1 shadow-sm min-w-0"
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
        onChange={(e) => setQuery(e.target.value)}
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
  )
}
