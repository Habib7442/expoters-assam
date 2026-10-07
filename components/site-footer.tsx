import Link from "next/link"

const FOOTER_LINKS = [
  {
    heading: "Explore",
    links: [
      { label: "Products", href: "/products" },
      { label: "Companies", href: "/companies" },
      { label: "Buy Leads", href: "/buy-requirements" },
      { label: "Membership", href: "/membership" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Your Data Rights", href: "/privacy#your-rights" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 sm:py-14 lg:grid-cols-4 lg:px-8">
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
          <span className="font-heading text-xl font-bold text-green-deep">
            Exporters <span className="text-green">Assam</span>
          </span>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            A B2B trade directory connecting Assam and Indian exporters of
            agarwood, spices, tea, essential oils, and more with buyers
            worldwide.
          </p>
        </div>

        {FOOTER_LINKS.map((column) => (
          <div key={column.heading} className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-green-deep">
              {column.heading}
            </span>
            <ul className="flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-green"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-green-deep">Contact</span>
          <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li>
              <a
                href="mailto:avadiherbsindia@gmail.com"
                className="transition-colors hover:text-green"
              >
                avadiherbsindia@gmail.com
              </a>
            </li>
            <li>Assam, India</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-2 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} Exporters Assam, a venture by
            Avadi Herbs India Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-green">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-green">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
