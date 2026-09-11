"use client"

import { COUNTRY_CODES, flagEmoji } from "@/lib/country-codes"
import { Input } from "@/components/ui/input"

type PhoneNumberInputProps = {
  id: string
  name: string
  countryCode: string
  localNumber: string
  onCountryCodeChange: (code: string) => void
  onLocalNumberChange: (value: string) => void
  required?: boolean
  ariaInvalid?: boolean
}

/**
 * A country-code select plus the local number, submitted as one combined
 * hidden field so the server action's existing `whatsappNumber`
 * validation/normalization never has to change. Two visible controls, one
 * field on the wire.
 */
export function PhoneNumberInput({
  id,
  name,
  countryCode,
  localNumber,
  onCountryCodeChange,
  onLocalNumberChange,
  required,
  ariaInvalid,
}: PhoneNumberInputProps) {
  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        value={countryCode}
        onChange={(e) => onCountryCodeChange(e.target.value)}
        className="h-9 w-[7.5rem] shrink-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {COUNTRY_CODES.map((country) => (
          <option key={country.iso} value={country.dialCode}>
            {flagEmoji(country.iso)} {country.dialCode}
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
      <input type="hidden" name={name} value={`${countryCode}${localNumber.replace(/\D/g, "")}`} />
    </div>
  )
}
