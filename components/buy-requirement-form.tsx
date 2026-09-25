"use client"

import Link from "next/link"
import { type SubmitEvent, useRef, useState, useTransition } from "react"

import { postBuyRequirement, type PostBuyRequirementResult } from "@/lib/actions/post-buy-requirement"
import { Button } from "@/components/ui/button"
import { ConsentCheckbox } from "@/components/consent-checkbox"
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/turnstile-widget"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Category = {
  id: string
  name: string
}

type BuyRequirementFormProps = {
  categories: Category[]
  /** Starting value for "What do you want to buy?", e.g. from a "post a similar requirement" link. */
  initialProductText?: string
}

export function BuyRequirementForm({ categories, initialProductText }: BuyRequirementFormProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<PostBuyRequirementResult | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)

  // A plain onSubmit handler, not <form action={fn}>: React resets every
  // uncontrolled field the instant a form action starts (before the action
  // even runs, regardless of success), which would wipe what the user just
  // typed on a validation error. Reading FormData here and resetting the
  // form ourselves, only once the submission actually succeeds, avoids that
  // entirely.
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setResult(null)
    startTransition(async () => {
      const response = await postBuyRequirement({
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        productText: String(formData.get("productText") ?? ""),
        quantity: String(formData.get("quantity") ?? ""),
        location: String(formData.get("location") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        isPublic: formData.get("isPublic") === "on",
        consent: formData.get("consent") === "on",
        turnstileToken: turnstileToken ?? undefined,
      })
      setResult(response)
      if (response.ok) formRef.current?.reset()
      // The token was consumed by this attempt; get a fresh one for a retry.
      else turnstileRef.current?.reset()
    })
  }

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined
  const topLevelError = result && !result.ok && result.code !== "invalid_input" ? result.message : null

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-green-deep">Requirement posted</h2>
        <p className="text-sm text-muted-foreground">
          {result.whatsappUrl
            ? "We've received your requirement. Continue on WhatsApp to hear back fastest."
            : "We've received your requirement. We'll get in touch soon."}
        </p>
        {result.whatsappUrl && (
          <Button
            size="lg"
            className="w-full rounded-full sm:w-auto"
            render={<Link href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            Continue on WhatsApp
          </Button>
        )}
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-product">What do you want to buy?</Label>
        <Input
          id="req-product"
          name="productText"
          required
          defaultValue={initialProductText}
          placeholder="e.g. Assam Agarwood Chips, Grade A"
          aria-invalid={!!fieldErrors?.productText}
        />
        {fieldErrors?.productText && <p className="text-xs text-destructive">{fieldErrors.productText}</p>}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="req-category">
            Category <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <select
            id="req-category"
            name="categoryId"
            defaultValue=""
            aria-invalid={!!fieldErrors?.categoryId}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldErrors?.categoryId && <p className="text-xs text-destructive">{fieldErrors.categoryId}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-quantity">Quantity</Label>
        <Input
          id="req-quantity"
          name="quantity"
          required
          placeholder="e.g. 500 kg / month"
          aria-invalid={!!fieldErrors?.quantity}
        />
        {fieldErrors?.quantity && <p className="text-xs text-destructive">{fieldErrors.quantity}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-location">
          Delivery location <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="req-location" name="location" placeholder="City, Country" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="req-notes" name="notes" rows={3} placeholder="Specifications, timeline, anything else" />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <Label htmlFor="req-name">Your name</Label>
        <Input id="req-name" name="name" required placeholder="Your name" aria-invalid={!!fieldErrors?.name} />
        {fieldErrors?.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-phone">Phone</Label>
        <Input
          id="req-phone"
          name="phone"
          type="tel"
          required
          placeholder="+91 98765 43210"
          aria-invalid={!!fieldErrors?.phone}
        />
        {fieldErrors?.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-email">
          Email <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="req-email" name="email" type="email" placeholder="you@example.com" />
      </div>

      <label htmlFor="req-public" className="flex items-start gap-2 text-sm text-muted-foreground">
        {/* Unticked by default: under the DPDP Act a pre-ticked box is not valid consent. */}
        <input id="req-public" name="isPublic" type="checkbox" className="mt-0.5 size-4 shrink-0" />
        Show this requirement publicly under Latest Buy Requirements, so sellers can find it (your name,
        phone, and email are never shown)
      </label>

      <ConsentCheckbox
        id="req-consent"
        purpose="record my requirement and contact me about it"
        error={fieldErrors?.consent}
      />

      <TurnstileWidget ref={turnstileRef} onToken={setTurnstileToken} />

      {topLevelError && <p className="text-sm text-destructive">{topLevelError}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full sm:w-auto">
        {pending ? "Posting..." : "Post requirement"}
      </Button>
    </form>
  )
}
