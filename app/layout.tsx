import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Sora } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every relative URL in page metadata (canonicals, OG images) resolves against the live domain.
  metadataBase: new URL(SITE_URL),
  title: "Exporters Assam: B2B Trade Directory for Assam & Indian Exporters",
  description:
    "Connect with verified exporters of agarwood, spices, tea, essential oils, and nursery plants from Assam and across India. Post buy requirements, send enquiries, and close deals directly over WhatsApp.",
  icons: {
    icon: [
      // Google Search shows a favicon only if it's a multiple of 48px, and
      // prefers larger ones; /favicon.ico (app/favicon.ico) is the 48px one.
      { url: "/favicons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicons/apple-touch-icon.png",
  },
  manifest: "/favicons/site.webmanifest",
  // Defaults every page inherits; pages override title, description, url and image.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable, sora.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ClerkProvider>
      </body>
    </html>
  );
}