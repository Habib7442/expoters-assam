"use client"

import Image from "next/image"
import Link from "next/link"
import { Show, SignInButton, UserButton } from "@clerk/nextjs"
import { Globe, Leaf, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const NAV_LINKS = [
  { label: "Products", href: "/products" },
  { label: "Companies", href: "/companies" },
  { label: "Buy Leads", href: "/buy-requirements" },
  { label: "Membership", href: "/membership" },
]

export function SiteHeader() {
  return (
    <div className="sticky top-0 z-50 w-full">
      <div className="hidden bg-green-wash sm:block">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 text-xs text-green-deep sm:px-6 lg:px-8">
          <span className="flex items-center gap-1.5">
            <Leaf className="size-3.5" aria-hidden="true" />
            Connecting Assam to the World
          </span>
          <span className="flex items-center gap-1">
            <Globe className="size-3.5" aria-hidden="true" />
            English &middot; India
          </span>
        </div>
      </div>

      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-3 sm:gap-6 sm:px-6 sm:py-4 lg:gap-8 lg:px-8">
          <Link href="/" className="flex shrink items-center gap-2 min-w-0">
            <Image
              src="/logo.png"
              alt="Avadi Herbs India Pvt. Ltd."
              width={60}
              height={40}
              className="h-9 w-auto shrink-0 rounded-md sm:h-11"
              priority
            />
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-heading text-base font-bold text-green-deep sm:text-xl truncate">
                Exports<span className="text-green">Assam</span>
              </span>
              <span className="hidden text-[11px] font-medium text-muted-foreground sm:block truncate">
                Your Gateway to Global Trade
              </span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-7 text-sm font-medium lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-foreground transition-colors hover:text-green"
              >
                {link.label}
              </Link>
            ))}
            <Show when="signed-in">
              <Link href="/list-business" className="text-foreground transition-colors hover:text-green">
                My Business
              </Link>
            </Show>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
            <Show when="signed-out">
              <SignInButton>
                <button className="hidden text-sm font-medium text-foreground transition-colors hover:text-green sm:block">
                  Sign In
                </button>
              </SignInButton>
              <Button
                render={<Link href="/list-business" />}
                nativeButton={false}
                className="rounded-full h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              >
                <span className="hidden sm:inline">List Your Business Free</span>
                <span className="sm:hidden">Join Free</span>
              </Button>
            </Show>
            <Show when="signed-in">
              <Button
                render={<Link href="/products/new" />}
                nativeButton={false}
                className="rounded-full h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              >
                <span className="hidden sm:inline">Add Product</span>
                <span className="sm:hidden">Add</span>
              </Button>
              <UserButton />
            </Show>

            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" aria-label="Open menu" />
                }
                className="lg:hidden"
              >
                <Menu className="size-4 sm:size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-3/4 gap-0 p-0 sm:max-w-xs">
                <SheetHeader className="border-b border-border p-4">
                  <SheetTitle className="text-green-deep">
                    ExportsAssam
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 p-4">
                  {NAV_LINKS.map((link) => (
                    <SheetClose
                      key={link.href}
                      render={<Link href={link.href} />}
                      nativeButton={false}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {link.label}
                    </SheetClose>
                  ))}
                  <Show when="signed-in">
                    <SheetClose
                      render={<Link href="/list-business" />}
                      nativeButton={false}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      My Business
                    </SheetClose>
                  </Show>
                  <Show when="signed-out">
                    <div className="mt-4 border-t border-border pt-4 flex flex-col gap-2">
                      <SheetClose
                        render={<Link href="/sign-in" />}
                        nativeButton={false}
                        className="rounded-lg px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-muted"
                      >
                        Sign In
                      </SheetClose>
                    </div>
                  </Show>
                  <Show when="signed-in">
                    <div className="mt-4 border-t border-border pt-4">
                      <SheetClose
                        render={<Link href="/products/new" />}
                        nativeButton={false}
                        className="rounded-lg px-3 py-2 text-center text-sm font-medium text-foreground hover:bg-muted"
                      >
                        Add Product
                      </SheetClose>
                    </div>
                  </Show>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </div>
  )
}
