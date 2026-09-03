"use client"

import { useState } from "react"
import { ChevronDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

const SEARCH_SCOPES = ["Products", "Companies", "Buy Leads"] as const

export function HeroSearch() {
  const [scope, setScope] = useState<(typeof SEARCH_SCOPES)[number]>("Products")

  return (
    <div className="flex w-full max-w-lg items-center rounded-full border border-border bg-background p-1 shadow-sm min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 rounded-l-full border-r border-border px-2.5 py-2 text-xs font-medium text-muted-foreground outline-none hover:text-foreground sm:px-4 sm:py-2.5 sm:text-sm">
          {scope}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SEARCH_SCOPES.map((option) => (
            <DropdownMenuItem key={option} onClick={() => setScope(option)}>
              {option}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        type="search"
        placeholder={`Search ${scope.toLowerCase()}...`}
        className="h-8 min-w-0 flex-1 border-0 px-2 text-xs shadow-none focus-visible:ring-0 sm:h-9 sm:px-3 sm:text-sm"
      />
      <Button className="h-8 shrink-0 rounded-full px-3 text-xs sm:h-9 sm:px-4 sm:text-sm" aria-label="Search">
        <Search className="size-3.5 sm:size-4" />
        <span className="hidden sm:inline">Search</span>
      </Button>
    </div>
  )
}
