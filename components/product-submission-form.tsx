"use client"

import Link from "next/link"
import { type ChangeEvent, type SubmitEvent, useRef, useState, useTransition } from "react"
import { RotateCcw, X } from "lucide-react"

import { updateProduct, type ManageProductResult } from "@/lib/actions/manage-product"
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

/** An existing product being edited (spec 0007); absent when submitting a new one. */
type EditedProduct = {
  id: string
  name: string
  description: string | null
  categoryId: string
  imageUrls: string[]
}

type ProductSubmissionFormProps = {
  categories: Category[]
  product?: EditedProduct
}

// Must match lib/product-images.ts (server only, so not importable here).
const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export function ProductSubmissionForm({ categories, product }: ProductSubmissionFormProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SubmitProductResult | ManageProductResult | null>(null)
  const [previews, setPreviews] = useState<string[]>([])
  // Editing: which of the product's current images to keep, in their original order.
  const [keptUrls, setKeptUrls] = useState<string[]>(product?.imageUrls ?? [])
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = product !== undefined

  function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    previews.forEach((url) => URL.revokeObjectURL(url))
    const files = Array.from(event.target.files ?? [])
    setPreviews(files.map((file) => URL.createObjectURL(file)))
  }

  function toggleKept(url: string) {
    if (!product) return
    setKeptUrls((current) =>
      current.includes(url)
        ? current.filter((kept) => kept !== url)
        : product.imageUrls.filter((original) => original === url || current.includes(original)),
    )
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
      // The same limits the server enforces (lib/product-images.ts), checked
      // here first so the supplier gets the right field error without
      // uploading anything. The count before shrinking, so nobody waits for
      // photos to be resized only to hear there are too many.
      const files = formData.getAll("images").filter((v): v is File => v instanceof File && v.size > 0)
      const keptCount = isEdit ? keptUrls.length : 0
      if (keptCount + files.length > MAX_IMAGES) {
        setResult({
          ok: false,
          code: "invalid_input",
          message: "Please check the form and try again.",
          fieldErrors: { images: isEdit ? `Up to ${MAX_IMAGES} images in total, counting the ones you keep.` : `Up to ${MAX_IMAGES} images.` },
        })
        return
      }
      // Shrink big phone photos first: every image travels in this one
      // request, which must stay under the server action body limit.
      const images = await Promise.all(files.map((file) => shrinkImage(file)))
      // shrinkImage keeps the original when it can't decode a file, and a
      // PNG can stay large after re-encoding, so check each result too.
      if (images.some((file) => file.size > MAX_IMAGE_BYTES)) {
        setResult({
          ok: false,
          code: "invalid_input",
          message: "Please check the form and try again.",
          fieldErrors: { images: "Each image must be under 2 MB." },
        })
        return
      }
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
      if (isEdit && keptUrls.length + images.length === 0) {
        setResult({
          ok: false,
          code: "invalid_input",
          message: "Please check the form and try again.",
          fieldErrors: { images: "Keep or add at least one image" },
        })
        return
      }

      const fields = {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
      }
      let response: SubmitProductResult | ManageProductResult
      try {
        response = isEdit
          ? await updateProduct({ ...fields, productId: product.id, keepImageUrls: keptUrls, newImages: images })
          : await submitProduct({ ...fields, images })
      } catch {
        // A dropped connection or a rejected request body throws here rather
        // than returning a result; show it in the form, never crash the page.
        response = {
          ok: false,
          code: "server_error",
          message: isEdit
            ? "We couldn't save your changes. Check your connection and try again."
            : "We couldn't send your product. Check your connection and try again.",
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
        <h2 className="font-heading text-xl font-semibold text-green-deep">
          {isEdit ? "Changes saved" : "Product submitted"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEdit
            ? "Your product is back in review. It will reappear on your company page once an admin approves the changes."
            : "Your product is pending review. It will appear on your company page once an admin approves it."}
        </p>
        <Button size="lg" className="rounded-full" render={<Link href="/my-products" />} nativeButton={false}>
          Go to My products
        </Button>
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
          defaultValue={product?.name}
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
          defaultValue={product?.categoryId ?? ""}
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
        <Textarea
          id="product-description"
          name="description"
          rows={3}
          defaultValue={product?.description ?? undefined}
          placeholder="Grade, pack size, origin..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {isEdit && product.imageUrls.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            <span className="text-sm font-medium">Current images</span>
            <p className="text-xs text-muted-foreground">
              Tap an image to remove it, tap again to keep it. The first image kept is the main photo.
            </p>
            <div className="flex flex-wrap gap-2">
              {product.imageUrls.map((url, i) => {
                const kept = keptUrls.includes(url)
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => toggleKept(url)}
                    aria-pressed={!kept}
                    aria-label={kept ? `Remove image ${i + 1}` : `Keep image ${i + 1}`}
                    className="relative size-16 overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className={kept ? "size-full object-cover" : "size-full object-cover opacity-30"} />
                    <span className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm">
                      {kept ? <X className="size-3" aria-hidden="true" /> : <RotateCcw className="size-3" aria-hidden="true" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <Label htmlFor="product-images">{isEdit ? "Add images" : "Images"}</Label>
        <Input
          id="product-images"
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          required={!isEdit}
          onChange={handleImagesChange}
          aria-invalid={!!fieldErrors?.images}
          className="h-auto py-1.5"
        />
        <p className="text-xs text-muted-foreground">
          {isEdit
            ? `JPG, PNG, or WebP. Up to ${MAX_IMAGES} images in total, counting the ones you keep.`
            : "JPG, PNG, or WebP, up to 5 images. Large photos are resized automatically."}
        </p>
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
        {pending ? (isEdit ? "Saving..." : "Submitting...") : isEdit ? "Save and send for review" : "Submit product"}
      </Button>
    </form>
  )
}
