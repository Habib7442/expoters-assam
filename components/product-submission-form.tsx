"use client"

import Link from "next/link"
import { type ChangeEvent, type SubmitEvent, useRef, useState, useTransition } from "react"

import { submitProduct, type SubmitProductResult } from "@/lib/actions/submit-product"
import { MAX_TOTAL_UPLOAD_BYTES, shrinkImage } from "@/lib/shrink-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Category = {
  id: string
  name: string
}

type ProductSubmissionFormProps = {
  categories: Category[]
}

export function ProductSubmissionForm({ categories }: ProductSubmissionFormProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SubmitProductResult | null>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    previews.forEach((url) => URL.revokeObjectURL(url))
    const files = Array.from(event.target.files ?? [])
    setPreviews(files.map((file) => URL.createObjectURL(file)))
  }

  // A plain onSubmit handler, not <form action={fn}>: React resets every
  // uncontrolled field the instant a form action starts, before the action
  // even runs, wiping what the user typed on a validation error. Reading
  // FormData here and resetting only on success avoids that (same fix as
  // buy-requirement-form.tsx).
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setResult(null)
    startTransition(async () => {
      // Shrink big phone photos first: every image travels in this one
      // request, which must stay under the server action body limit.
      const images = await Promise.all(
        formData
          .getAll("images")
          .filter((v): v is File => v instanceof File && v.size > 0)
          .map((file) => shrinkImage(file)),
      )
      const totalBytes = images.reduce((sum, file) => sum + file.size, 0)
      if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
        setResult({
          ok: false,
          code: "invalid_input",
          message: "Please check the form and try again.",
          fieldErrors: { images: "These images are too large together. Try fewer or smaller images." },
        })
        return
      }

      let response: SubmitProductResult
      try {
        response = await submitProduct({
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? ""),
          categoryId: String(formData.get("categoryId") ?? ""),
          images,
        })
      } catch {
        // A dropped connection or a rejected request body throws here rather
        // than returning a result; show it in the form, never crash the page.
        response = {
          ok: false,
          code: "server_error",
          message: "We couldn't send your product. Check your connection and try again.",
        }
      }
      setResult(response)
      if (response.ok) {
        formRef.current?.reset()
        previews.forEach((url) => URL.revokeObjectURL(url))
        setPreviews([])
      }
    })
  }

  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined
  const topLevelError = result && !result.ok && result.code !== "invalid_input" ? result.message : null

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-green-deep">Product submitted</h2>
        <p className="text-sm text-muted-foreground">
          Your product is pending review. It will appear on your company page once an admin approves it.
        </p>
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
        <Label htmlFor="product-name">Product name</Label>
        <Input
          id="product-name"
          name="name"
          required
          placeholder="e.g. Assam Agarwood Chips, Grade A"
          aria-invalid={!!fieldErrors?.name}
        />
        {fieldErrors?.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-category">Category</Label>
        <select
          id="product-category"
          name="categoryId"
          required
          defaultValue=""
          aria-invalid={!!fieldErrors?.categoryId}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {fieldErrors?.categoryId && <p className="text-xs text-destructive">{fieldErrors.categoryId}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="product-description" name="description" rows={3} placeholder="Grade, pack size, origin..." />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-images">Images</Label>
        <Input
          id="product-images"
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={handleImagesChange}
          aria-invalid={!!fieldErrors?.images}
          className="h-auto py-1.5"
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP, up to 5 images. Large photos are resized automatically.</p>
        {fieldErrors?.images && <p className="text-xs text-destructive">{fieldErrors.images}</p>}
        {previews.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={`Preview ${i + 1}`} className="size-16 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>

      {topLevelError && (
        <p className="text-sm text-destructive">
          {topLevelError}
          {result && !result.ok && result.code === "company_not_approved" && (
            <>
              {" "}
              <Link href="/list-business" className="underline">
                Check your listing status
              </Link>
              .
            </>
          )}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full rounded-full sm:w-auto">
        {pending ? "Submitting..." : "Submit product"}
      </Button>
    </form>
  )
}
