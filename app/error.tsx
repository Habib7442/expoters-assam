"use client"

import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

// Site-wide safety net: an unexpected error shows this, inside the normal
// header and footer, instead of Next's bare "Application error" page.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-bg-soft px-4 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-2xl font-bold text-green-deep">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Sorry, this page ran into a problem. Please try again. If it keeps happening, email us at{" "}
          <a href="mailto:info@exportsassam.com" className="text-green underline underline-offset-2">
            info@exportsassam.com
          </a>
          .
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button className="rounded-full" onClick={() => retry()}>
            Try again
          </Button>
          <Button variant="outline" className="rounded-full" render={<Link href="/" />} nativeButton={false}>
            Go to the home page
          </Button>
        </div>
      </div>
    </main>
  )
}
