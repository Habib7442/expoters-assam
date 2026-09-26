import { describe, expect, it } from "vitest";

import { hasValidPhoneDigitCount } from "./phone";

describe("hasValidPhoneDigitCount", () => {
  it.each([
    ["an Indian mobile without a code", "98765 43210"],
    ["an Indian mobile with +91", "+91 98765 43210"],
    ["the STD 0 prefix", "098765 43210"],
    ["a 15 digit international number", "+123 456 789 012 345"],
    ["00 plus a 15 digit number (the 00 is a dialing prefix, not part of the number)", "00 123 456 789 012 345"],
    ["00 plus a 14 digit number", "00 12345 678 901 234"],
  ])("accepts %s", (_label, value) => {
    expect(hasValidPhoneDigitCount(value)).toBe(true);
  });

  it.each([
    ["too few digits", "98765"],
    ["symbols with too few digits", "(+) - 12 - ()"],
    ["16 digits without a 00 prefix", "+1234 5678 9012 3456"],
    ["00 plus 16 digits", "00 1234 5678 9012 3456"],
    ["00 plus too few digits", "00 12345"],
  ])("rejects %s", (_label, value) => {
    expect(hasValidPhoneDigitCount(value)).toBe(false);
  });
});
