"use client"

import { COUNTRY_CODES, flagEmoji } from "@/lib/country-codes"
import { Input } from "@/components/ui/input"

type PhoneNumberInputProps = {
  id: string
  name: string
  countryIso: string
  localNumber: string
  onCountryIsoChange: (iso: string) => void
  onLocalNumberChange: (value: string) => void
  required?: boolean
  ariaInvalid?: boolean
}

/**
 * A country-code select plus the local number, submitted as one combined
 * hidden field so the server action's existing `whatsappNumber`
 * validation/normalization never has to change. Two visible controls, one
 * field on the wire.
 *
 * The select is controlled by ISO code, not dial code: several countries
 * share a dial code (US and Canada are both +1), and a native `<select>`
 * with a controlled value can't distinguish two `<option>`s with the same
 * `value` — it always resolves to whichever matching option comes first in
 * the DOM, so a dial-code-controlled select would silently redisplay the
 * United States after a user picks Canada. ISO codes are unique, so the
 * dial code for the hidden field is derived from the selected ISO instead.
 */
export function PhoneNumberInput({
  id,
  name,
  countryIso,
  localNumber,
  onCountryIsoChange,
  onLocalNumberChange,
  required,
  ariaInvalid,
}: PhoneNumberInputProps) {
  const dialCode = COUNTRY_CODES.find((country) => country.iso === countryIso)?.dialCode ?? COUNTRY_CODES[0]!.dialCode

  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        value={countryIso}
        onChange={(e) => onCountryIsoChange(e.target.value)}
        className="h-9 w-40 shrink-0 truncate rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {COUNTRY_CODES.map((country) => (
          <option key={country.iso} value={country.iso}>
            {flagEmoji(country.iso)} {country.name} ({country.dialCode})
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        required={required}
        value={localNumber}
        onChange={(e) => onLocalNumberChange(e.target.value)}
        placeholder="98765 43210"
        aria-invalid={ariaInvalid}
        className="flex-1"
      />
      <input type="hidden" name={name} value={`${dialCode}${localNumber.replace(/\D/g, "")}`} />
    </div>
  )
}
