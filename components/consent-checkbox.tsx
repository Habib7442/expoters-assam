import Link from "next/link"

type ConsentCheckboxProps = {
  id: string
  /** What the details will be used for, completing "…consent to Exporters Assam using these details to ___". */
  purpose: string
  error?: string
}

/**
 * The DPDP Act point-of-collection notice: an unticked, required checkbox
 * naming the purpose, linked to the full Privacy Policy. Submits as
 * `consent=on`; every server action receiving it re-checks it, so the
 * browser's `required` is not the only guard.
 */
export function ConsentCheckbox({ id, purpose, error }: ConsentCheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <input
          id={id}
          name="consent"
          type="checkbox"
          required
          aria-invalid={!!error}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green underline underline-offset-2"
          >
            Privacy Policy
          </Link>{" "}
          and consent to Exporters Assam using these details to {purpose}. I can withdraw this consent at
          any time.
        </span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
