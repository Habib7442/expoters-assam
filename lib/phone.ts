/**
 * Whether a typed phone number has a plausible number of digits (10 to 15,
 * the E.164 range), counted the way the database normalizes it: a leading
 * "00" international dialing prefix is dropped first, so "00" plus a full
 * 15 digit number still passes. Mirrors the phone normalization trigger in
 * `supabase/migrations/20260827080000_add_company_contacts_and_product_slug.sql`.
 */
export function hasValidPhoneDigitCount(value: string): boolean {
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 15;
}
