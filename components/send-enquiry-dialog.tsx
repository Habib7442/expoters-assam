"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { sendEnquiry, type SendEnquiryResult } from "@/lib/actions/send-enquiry"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type SendEnquiryDialogProps = {
  target:
    | { type: "product"; productId: string; productName: string }
    | { type: "company"; companyId: string; companyName: string }
}

export function SendEnquiryDialog({ target }: SendEnquiryDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SendEnquiryResult | null>(null)

  const targetName = target.type === "product" ? target.productName : target.companyName

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTransition(async () => {
      const contact = {
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        message: String(formData.get("message") ?? ""),
      }
      const response = await sendEnquiry(
        target.type === "product"
          ? { targetType: "product", productId: target.productId, productName: target.productName, ...contact }
          : { targetType: "company", companyId: target.companyId, companyName: target.companyName, ...contact },
      )
      setResult(response)
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setResult(null)
  }

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined
  const topLevelError = result && !result.ok && result.code !== "invalid_input" ? result.message : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" className="rounded-full" />}>
        Send Enquiry
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {result?.ok ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Enquiry sent</DialogTitle>
              <DialogDescription>
                {result.whatsappUrl
                  ? "We've received your enquiry. Continue on WhatsApp to hear back fastest."
                  : "We've received your enquiry. The supplier will get in touch soon."}
              </DialogDescription>
            </DialogHeader>
            {result.whatsappUrl && (
              <Button
                size="lg"
                className="w-full rounded-full"
                render={<Link href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                Continue on WhatsApp
              </Button>
            )}
            <DialogClose render={<Button variant="outline" className="w-full rounded-full" />}>
              Close
            </DialogClose>
          </div>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Send an enquiry</DialogTitle>
              <DialogDescription className="line-clamp-2">
                About &quot;{targetName}&quot;
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enquiry-name">Name</Label>
                <Input
                  id="enquiry-name"
                  name="name"
                  required
                  placeholder="Your name"
                  aria-invalid={!!fieldErrors?.name}
                />
                {fieldErrors?.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enquiry-phone">Phone</Label>
                <Input
                  id="enquiry-phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  aria-invalid={!!fieldErrors?.phone}
                />
                {fieldErrors?.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enquiry-email">
                  Email <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="enquiry-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  aria-invalid={!!fieldErrors?.email}
                />
                {fieldErrors?.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enquiry-message">
                  Message <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="enquiry-message"
                  name="message"
                  rows={3}
                  placeholder="Quantity needed, delivery location, questions..."
                />
              </div>
            </div>

            {topLevelError && <p className="text-sm text-destructive">{topLevelError}</p>}

            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full rounded-full sm:w-auto">
                {pending ? "Sending..." : "Send Enquiry"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
