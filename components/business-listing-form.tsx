"use client"

import Image from "next/image"
import { type ChangeEvent, useState, useTransition } from "react"

import {
  submitBusinessListing,
  updateBusinessListing,
  type BusinessListingResult,
} from "@/lib/actions/business-listing"
import { COUNTRY_CODES, splitPhoneNumber } from "@/lib/country-codes"
import { Button } from "@/components/ui/button"
import { ConsentCheckbox } from "@/components/consent-checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneNumberInput } from "@/components/phone-number-input"
import { Textarea } from "@/components/ui/textarea"

type BusinessListingFormProps = {
  mode: "create" | "edit"
  initialValues?: {
    name: string
    addressLine: string | null
    location: string | null
    state: string | null
    postalCode: string | null
    country: string
    about: string | null
    email: string | null
    gstNumber: string | null
    whatsappNumber: string | null
    logoUrl: string | null
  }
  rejectionReason?: string | null
}

export function BusinessListingForm({ mode, initialValues, rejectionReason }: BusinessListingFormProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<BusinessListingResult | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(initialValues?.logoUrl ?? null)

  // Controlled, not defaultValue: <form action={fn}> resets every
  // uncontrolled field the instant a submission starts (React's built-in
  // form-action behavior, not tied to whether the action succeeds), so a
  // validation error would otherwise wipe what the user just typed. A
  // controlled value survives that reset since React re-asserts it from
  // state on the next render. The file input can't be controlled (browser
  // security), so it still clears on any submission — unavoidable.
  const initialPhone = splitPhoneNumber(initialValues?.whatsappNumber ?? COUNTRY_CODES[0]!.dialCode)
  const [name, setName] = useState(initialValues?.name ?? "")
  const [addressLine, setAddressLine] = useState(initialValues?.addressLine ?? "")
  const [location, setLocation] = useState(initialValues?.location ?? "")
  const [state, setState] = useState(initialValues?.state ?? "")
  const [postalCode, setPostalCode] = useState(initialValues?.postalCode ?? "")
  const [country, setCountry] = useState(initialValues?.country ?? "India")
  const [email, setEmail] = useState(initialValues?.email ?? "")
  const [gstNumber, setGstNumber] = useState(initialValues?.gstNumber ?? "")
  const [countryIso, setCountryIso] = useState(initialPhone.countryIso)
  const [localNumber, setLocalNumber] = useState(initialPhone.localNumber)
  const [about, setAbout] = useState(initialValues?.about ?? "")

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your business name"
          aria-invalid={!!fieldErrors?.name}
        />
        {fieldErrors?.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-address">Business address</Label>
        <Textarea
          id="listing-address"
          name="addressLine"
          required
          rows={2}
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="Building, street, area"
          aria-invalid={!!fieldErrors?.addressLine}
        />
        {fieldErrors?.addressLine && <p className="text-xs text-destructive">{fieldErrors.addressLine}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-location">City</Label>
          <Input
            id="listing-location"
            name="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City"
            aria-invalid={!!fieldErrors?.location}
          />
          {fieldErrors?.location && <p className="text-xs text-destructive">{fieldErrors.location}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-state">State</Label>
          <Input
            id="listing-state"
            name="state"
            required
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="State"
            aria-invalid={!!fieldErrors?.state}
          />
          {fieldErrors?.state && <p className="text-xs text-destructive">{fieldErrors.state}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="listing-country">Country</Label>
          <Input
            id="listing-country"
            name="country"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            aria-invalid={!!fieldErrors?.country}
          />
          {fieldErrors?.country && <p className="text-xs text-destructive">{fieldErrors.country}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-[calc((100%-1.5rem)/3)]">
        <Label htmlFor="listing-postal-code">
          PIN code <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="listing-postal-code"
          name="postalCode"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="PIN code"
          aria-invalid={!!fieldErrors?.postalCode}
        />
        {fieldErrors?.postalCode && <p className="text-xs text-destructive">{fieldErrors.postalCode}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-email">Business email</Label>
        <Input
          id="listing-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          aria-invalid={!!fieldErrors?.email}
        />
        {fieldErrors?.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-whatsapp">WhatsApp number</Label>
        <PhoneNumberInput
          id="listing-whatsapp"
          name="whatsappNumber"
          required
          countryIso={countryIso}
          localNumber={localNumber}
          onCountryIsoChange={setCountryIso}
          onLocalNumberChange={setLocalNumber}
          ariaInvalid={!!fieldErrors?.whatsappNumber}
        />
        {fieldErrors?.whatsappNumber && (
          <p className="text-xs text-destructive">{fieldErrors.whatsappNumber}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-gst">
          GST number <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="listing-gst"
          name="gstNumber"
          value={gstNumber}
          onChange={(e) => setGstNumber(e.target.value)}
          placeholder="e.g. 18AABCU9603R1ZM"
          aria-invalid={!!fieldErrors?.gstNumber}
        />
        {fieldErrors?.gstNumber && <p className="text-xs text-destructive">{fieldErrors.gstNumber}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="listing-about">
          About <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="listing-about"
          name="about"
          rows={3}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
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

      {mode === "create" && (
        <ConsentCheckbox
          id="listing-consent"
          purpose="review and publish my business listing, including showing my business name, logo, location, and WhatsApp number publicly once it's approved"
          error={fieldErrors?.consent}
        />
      )}

      {topLevelError && <p className="text-sm text-destructive">{topLevelError}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full sm:w-auto">
        {pending ? "Saving..." : mode === "create" ? "Submit listing" : "Save changes"}
      </Button>
    </form>
  )
}
