"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

import { deleteProduct } from "@/lib/actions/manage-product"
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

/** Asks before permanently deleting one of the supplier's own products (spec 0007, AC-3). */
export function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteProduct(productId)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setOpen(false)
        router.refresh()
      } catch {
        setError("We couldn't delete this product. Check your connection and try again.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-full text-destructive" />}>
        <Trash2 className="size-3.5" aria-hidden="true" />
        Delete
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this product?</DialogTitle>
          <DialogDescription>
            &quot;{productName}&quot; and its images will be removed for good. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="rounded-full" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" className="rounded-full" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
