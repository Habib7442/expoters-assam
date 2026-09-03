"use client"

import Image from "next/image"
import { type ChangeEvent, useState, useTransition } from "react"

import {
  submitBusinessListing,
  updateBusinessListing,
  type BusinessListingResult,
} from "@/lib/actions/business-listing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type BusinessListingFormProps = {
  mode: "create" | "edit"
  initialValues?: {
    name: string
    location: string | null
    about: string | null
    email: string | null
    whatsappNumber: string | null
    logoUrl: string | null
  }
  rejectionReason?: string | null
}

export function BusinessListingForm({ mode, initialValues, rejectionReason }: BusinessListingFormProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<BusinessListingResult | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(initialValues?.logoUrl ?? null)

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTransition(async () => {
      const action = mode === "create" ? submitBusinessListing : updateBusinessListing
      const response = await action(formData)
      setResult(response)
    })
  }

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined
  const topLevelError = result && !result.ok && result.code !== "invalid_input" ? result.message : null

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-green-deep">
          {mode === "create" ? "Listing submitted" : "Changes saved"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your business is pending review. We&apos;ll let you know once an admin has reviewed it.
        </p>
      </div>
    )
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8"
    >
      {rejectionReason && (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Your listing was not approved</p>
          <p className="mt-1">{rejectionReason}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-name">Business name</Label>
        <Input
          id="listing-name"
          name="name"
          required
          defaultValue={initialValues?.name}
          placeholder="Your business name"
          aria-invalid={!!fieldErrors?.name}
        />
        {fieldErrors?.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-location">Location</Label>
        <Input
          id="listing-location"
          name="location"
          required
          defaultValue={initialValues?.location ?? undefined}
          placeholder="City, State"
          aria-invalid={!!fieldErrors?.location}
        />
        {fieldErrors?.location && <p className="text-xs text-destructive">{fieldErrors.location}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-email">Business email</Label>
        <Input
          id="listing-email"
          name="email"
          type="email"
          required
          defaultValue={initialValues?.email ?? undefined}
          placeholder="you@yourbusiness.com"
          aria-invalid={!!fieldErrors?.email}
        />
        {fieldErrors?.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-whatsapp">WhatsApp number</Label>
        <Input
          id="listing-whatsapp"
          name="whatsappNumber"
          type="tel"
          required
          defaultValue={initialValues?.whatsappNumber ?? undefined}
          placeholder="+91 98765 43210"
          aria-invalid={!!fieldErrors?.whatsappNumber}
        />
        {fieldErrors?.whatsappNumber && (
          <p className="text-xs text-destructive">{fieldErrors.whatsappNumber}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-about">
          About <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="listing-about"
          name="about"
          rows={3}
          defaultValue={initialValues?.about ?? undefined}
          placeholder="What do you export, and what makes your business stand out?"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-logo">
          Logo{" "}
          {mode === "edit" && (
            <span className="font-normal text-muted-foreground">(optional, keeps the current one if left blank)</span>
          )}
        </Label>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <Image
              src={logoPreview}
              alt="Logo preview"
              width={64}
              height={64}
              unoptimized
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-green-wash text-[10px] text-muted-foreground">
              No logo
            </div>
          )}
          <Input
            id="listing-logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={mode === "create"}
            onChange={handleLogoChange}
            aria-invalid={!!fieldErrors?.logo}
            className="h-auto max-w-xs py-1.5"
          />
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP, up to 2 MB.</p>
        {fieldErrors?.logo && <p className="text-xs text-destructive">{fieldErrors.logo}</p>}
      </div>

      {topLevelError && <p className="text-sm text-destructive">{topLevelError}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full sm:w-auto">
        {pending ? "Saving..." : mode === "create" ? "Submit listing" : "Save changes"}
      </Button>
    </form>
  )
}
