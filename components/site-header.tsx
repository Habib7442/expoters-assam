"use client"

import Image from "next/image"
import Link from "next/link"
import { Show, SignInButton, UserButton } from "@clerk/nextjs"
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Crown,
  FileText,
  Globe,
  Leaf,
  LogIn,
  Mail,
  Menu,
  Package,
  Plus,
  Sparkles,
  Store,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "Products", href: "/products" },
  { label: "Companies", href: "/companies" },
  { label: "Buy Leads", href: "/buy-requirements" },
  { label: "Membership", href: "/membership" },
]

const MOBILE_NAV_ITEMS = [
  {
    label: "Explore Products",
    href: "/products",
    description: "Agarwood, Tea, Spices & Organic",
    icon: Package,
    color: "bg-green/15 text-green ring-1 ring-green/25",
    badge: null,
    badgeClass: "",
  },
  {
    label: "Exporters & Suppliers",
    href: "/companies",
    description: "Approved exporters and suppliers",
    icon: Building2,
    color: "bg-green-deep/10 text-green-deep ring-1 ring-green-deep/20",
    badge: null,
    badgeClass: "",
  },
  {
    label: "Buy Leads & RFQs",
    href: "/buy-requirements",
    description: "Active buyer trade requests",
    icon: ClipboardList,
    color: "bg-gold/15 text-gold ring-1 ring-gold/30",
    badge: "Live Leads",
    badgeClass: "bg-gold/10 text-gold border-gold/30",
  },
  {
    label: "Supplier Membership",
    href: "/membership",
    description: "Silver & Gold export benefits",
    icon: Crown,
    color: "bg-leaf/20 text-green-deep ring-1 ring-leaf/30",
    badge: "Plans",
    badgeClass: "bg-gold/15 text-gold border-gold/30",
  },
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
                Exporters <span className="text-green">Assam</span>
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
              <SheetContent
                side="left"
                className="flex h-full w-[85vw] max-w-[340px] flex-col gap-0 p-0 sm:max-w-sm"
              >
                {/* Header with Logo, Brand & Tagline */}
                <SheetHeader className="border-b border-border bg-gradient-to-br from-green-wash/85 via-bg-soft to-background p-4 pr-12 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green/20 bg-background p-1 shadow-xs">
                      <Image
                        src="/logo.png"
                        alt="Exporters Assam"
                        width={40}
                        height={40}
                        className="h-full w-auto object-contain"
                        priority
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <SheetTitle className="font-heading text-lg font-bold tracking-tight text-green-deep">
                        Exporters <span className="text-green">Assam</span>
                      </SheetTitle>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground truncate">
                        <Leaf className="size-3 text-leaf shrink-0" aria-hidden="true" />
                        B2B Trade Directory &bull; Assam
                      </span>
                    </div>
                  </div>
                </SheetHeader>

                {/* Scrollable Main Area */}
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                  {/* Highlight Banner */}
                  <div className="rounded-xl border border-leaf/25 bg-gradient-to-r from-green-wash/70 via-green-wash/40 to-bg-soft p-3 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-green-deep">
                      <Sparkles className="size-3.5 text-gold shrink-0" />
                      <span>Assam&apos;s Global Gateway</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Direct trade with exporters of agarwood, spices, tea &amp; herbs.
                    </p>
                  </div>

                  {/* Navigation Links with Bright Colored Badges & Icons */}
                  <div className="flex flex-col gap-1.5">
                    <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Directory
                    </span>
                    <nav className="flex flex-col gap-1">
                      {MOBILE_NAV_ITEMS.map((item) => {
                        const Icon = item.icon
                        return (
                          <SheetClose
                            key={item.href}
                            render={<Link href={item.href} />}
                            nativeButton={false}
                            className="group flex items-center justify-between gap-3 rounded-xl p-2.5 transition-all hover:bg-green-wash/40 active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform group-hover:scale-105",
                                  item.color
                                )}
                              >
                                <Icon className="size-4.5" />
                              </div>
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-sm font-semibold text-foreground group-hover:text-green-deep">
                                  {item.label}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {item.description}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.badge && (
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight",
                                    item.badgeClass
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}
                              <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-green" />
                            </div>
                          </SheetClose>
                        )
                      })}
                    </nav>
                  </div>

                  {/* Quick Action / CTA Buttons */}
                  <Show when="signed-out">
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-border/80">
                      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </span>
                      {/* Primary CTA: List Your Business Free */}
                      <SheetClose
                        render={<Link href="/list-business" />}
                        nativeButton={false}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-green/25 transition-all hover:bg-green-deep active:scale-[0.99]"
                      >
                        <Store className="size-4" />
                        <span>List Your Business</span>
                        <span className="rounded bg-primary-foreground/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                          Free
                        </span>
                      </SheetClose>

                      {/* Secondary CTA: Post Buy Requirement */}
                      <SheetClose
                        render={<Link href="/buy-requirements/new" />}
                        nativeButton={false}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-green/30 bg-background px-4 py-2.5 text-sm font-semibold text-green-deep shadow-2xs transition-all hover:bg-green-wash/40 active:scale-[0.99]"
                      >
                        <FileText className="size-4 text-green" />
                        <span>Post Buy Requirement</span>
                      </SheetClose>

                      {/* Sign In CTA */}
                      <SheetClose
                        render={<Link href="/sign-in" />}
                        nativeButton={false}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.99]"
                      >
                        <LogIn className="size-4 text-muted-foreground" />
                        <span>Sign In</span>
                      </SheetClose>
                    </div>
                  </Show>

                  <Show when="signed-in">
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-border/80">
                      <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        My Account
                      </span>
                      <div className="flex items-center gap-3 rounded-xl border border-green/20 bg-green-wash/40 p-2.5">
                        <UserButton />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-green-deep">Signed In</span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            Manage products &amp; leads
                          </span>
                        </div>
                      </div>

                      <SheetClose
                        render={<Link href="/products/new" />}
                        nativeButton={false}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-green/25 transition-all hover:bg-green-deep active:scale-[0.99]"
                      >
                        <Plus className="size-4" />
                        <span>Add New Product</span>
                      </SheetClose>

                      <SheetClose
                        render={<Link href="/list-business" />}
                        nativeButton={false}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-2xs transition-all hover:bg-muted active:scale-[0.99]"
                      >
                        <Store className="size-4 text-green" />
                        <span>My Business Profile</span>
                      </SheetClose>

                      <SheetClose
                        render={<Link href="/buy-requirements/new" />}
                        nativeButton={false}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-green/30 bg-background px-4 py-2.5 text-sm font-medium text-green-deep transition-all hover:bg-green-wash/40 active:scale-[0.99]"
                      >
                        <FileText className="size-4 text-green" />
                        <span>Post Buy Requirement</span>
                      </SheetClose>
                    </div>
                  </Show>
                </div>

                {/* Footer with Trust & Contact info */}
                <div className="mt-auto border-t border-border bg-bg-soft/70 px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium text-green-deep">
                      <Leaf className="size-3.5 text-leaf shrink-0" aria-hidden="true" />
                      B2B Trade Directory
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Avadi Herbs
                    </span>
                  </div>
                  <a
                    href="mailto:info@exportsassam.com"
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-green"
                  >
                    <Mail className="size-3 shrink-0" />
                    info@exportsassam.com
                  </a>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </div>
  )
}
