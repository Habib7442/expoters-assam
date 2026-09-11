export type CountryCode = {
  /** ISO 3166-1 alpha-2, used to derive the flag emoji programmatically. */
  iso: string;
  name: string;
  dialCode: string;
};

// India first (this platform's primary supplier base, and the form's
// existing default), then major trading-partner countries roughly by how
// often a B2B export directory would see them. Not exhaustive — a curated,
// verifiable list beats a hand-typed 195-country one where a single
// transposed digit silently breaks a real user's contact number.
export const COUNTRY_CODES: CountryCode[] = [
  { iso: "IN", name: "India", dialCode: "+91" },
  { iso: "US", name: "United States", dialCode: "+1" },
  { iso: "CA", name: "Canada", dialCode: "+1" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { iso: "QA", name: "Qatar", dialCode: "+974" },
  { iso: "KW", name: "Kuwait", dialCode: "+965" },
  { iso: "OM", name: "Oman", dialCode: "+968" },
  { iso: "BH", name: "Bahrain", dialCode: "+973" },
  { iso: "SG", name: "Singapore", dialCode: "+65" },
  { iso: "MY", name: "Malaysia", dialCode: "+60" },
  { iso: "TH", name: "Thailand", dialCode: "+66" },
  { iso: "ID", name: "Indonesia", dialCode: "+62" },
  { iso: "VN", name: "Vietnam", dialCode: "+84" },
  { iso: "PH", name: "Philippines", dialCode: "+63" },
  { iso: "HK", name: "Hong Kong", dialCode: "+852" },
  { iso: "TW", name: "Taiwan", dialCode: "+886" },
  { iso: "CN", name: "China", dialCode: "+86" },
  { iso: "JP", name: "Japan", dialCode: "+81" },
  { iso: "KR", name: "South Korea", dialCode: "+82" },
  { iso: "AU", name: "Australia", dialCode: "+61" },
  { iso: "NZ", name: "New Zealand", dialCode: "+64" },
  { iso: "DE", name: "Germany", dialCode: "+49" },
  { iso: "FR", name: "France", dialCode: "+33" },
  { iso: "IT", name: "Italy", dialCode: "+39" },
  { iso: "ES", name: "Spain", dialCode: "+34" },
  { iso: "NL", name: "Netherlands", dialCode: "+31" },
  { iso: "BE", name: "Belgium", dialCode: "+32" },
  { iso: "CH", name: "Switzerland", dialCode: "+41" },
  { iso: "SE", name: "Sweden", dialCode: "+46" },
  { iso: "NO", name: "Norway", dialCode: "+47" },
  { iso: "DK", name: "Denmark", dialCode: "+45" },
  { iso: "PL", name: "Poland", dialCode: "+48" },
  { iso: "RU", name: "Russia", dialCode: "+7" },
  { iso: "TR", name: "Turkey", dialCode: "+90" },
  { iso: "IL", name: "Israel", dialCode: "+972" },
  { iso: "EG", name: "Egypt", dialCode: "+20" },
  { iso: "ZA", name: "South Africa", dialCode: "+27" },
  { iso: "NG", name: "Nigeria", dialCode: "+234" },
  { iso: "KE", name: "Kenya", dialCode: "+254" },
  { iso: "BR", name: "Brazil", dialCode: "+55" },
  { iso: "MX", name: "Mexico", dialCode: "+52" },
  { iso: "BD", name: "Bangladesh", dialCode: "+880" },
  { iso: "PK", name: "Pakistan", dialCode: "+92" },
  { iso: "NP", name: "Nepal", dialCode: "+977" },
  { iso: "LK", name: "Sri Lanka", dialCode: "+94" },
  { iso: "MM", name: "Myanmar", dialCode: "+95" },
  { iso: "AF", name: "Afghanistan", dialCode: "+93" },
  { iso: "IQ", name: "Iraq", dialCode: "+964" },
  { iso: "IR", name: "Iran", dialCode: "+98" },
];

/** Regional-indicator flag emoji derived from an ISO alpha-2 code — never hand-typed, so it can't mismatch the code next to it. */
export function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/**
 * Splits a stored E.164-ish number (e.g. "+919876543210") back into the
 * country code and local digits, for pre-filling the edit form. Longest
 * dial code first, so a number isn't matched against a shorter code that
 * happens to be a prefix of the right one. Falls back to this list's first
 * entry (India) if nothing matches, treating the whole value as local
 * digits — better than showing a blank, incorrect split.
 */
export function splitPhoneNumber(value: string): { countryCode: string; localNumber: string } {
  const trimmed = value.trim();
  const byLength = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const country of byLength) {
    if (trimmed.startsWith(country.dialCode)) {
      return { countryCode: country.dialCode, localNumber: trimmed.slice(country.dialCode.length).trim() };
    }
  }
  return { countryCode: COUNTRY_CODES[0]!.dialCode, localNumber: trimmed.replace(/^\+/, "") };
}
