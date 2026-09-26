"use client"

import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A small spinner for inside a `<Link>`: visible only while that link's
 * navigation is pending (the page it leads to hasn't arrived yet), so a
 * click on a slow link never looks like it did nothing. Must be rendered
 * as a descendant of the Link (a `useLinkStatus` rule).
 */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <Loader2 className={cn("size-3 animate-spin motion-reduce:animate-none", className)} aria-hidden="true" />
  )
}
