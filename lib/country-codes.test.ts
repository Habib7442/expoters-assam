import { describe, expect, it } from "vitest";

import { flagEmoji, splitPhoneNumber } from "./country-codes";

describe("flagEmoji", () => {
  // Verified against the actual known flag glyphs, not just internal consistency.
  it("derives the correct regional-indicator flag for a known ISO code", () => {
    expect(flagEmoji("IN")).toBe("🇮🇳");
    expect(flagEmoji("US")).toBe("🇺🇸");
    expect(flagEmoji("AE")).toBe("🇦🇪");
  });
});

describe("splitPhoneNumber", () => {
  it("splits an India number", () => {
    expect(splitPhoneNumber("+919876543210")).toEqual({ countryCode: "+91", localNumber: "9876543210" });
  });

  it("splits a US number without matching a shorter, unrelated code first", () => {
    expect(splitPhoneNumber("+14155552671")).toEqual({ countryCode: "+1", localNumber: "4155552671" });
  });

  it("splits a three-digit dial code (UAE)", () => {
    expect(splitPhoneNumber("+971501234567")).toEqual({ countryCode: "+971", localNumber: "501234567" });
  });

  it("falls back to the first country (India) for a bare number with no country code", () => {
    expect(splitPhoneNumber("9876543210")).toEqual({ countryCode: "+91", localNumber: "9876543210" });
  });

  it("round trips a value produced by the form's own hidden-field format", () => {
    const combined = "+919876543210";
    const { countryCode, localNumber } = splitPhoneNumber(combined);
    expect(`${countryCode}${localNumber}`).toBe(combined);
  });
});
