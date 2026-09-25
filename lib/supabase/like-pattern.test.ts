import { describe, expect, it } from "vitest";

import { containsPattern } from "./like-pattern";

const BS = String.fromCharCode(92);

describe("containsPattern", () => {
  it("wraps plain text in contains wildcards", () => {
    expect(containsPattern("tea")).toBe("%tea%");
  });

  it("escapes % so a typed percent sign is literal, not a wildcard", () => {
    expect(containsPattern("50%")).toBe(`%50${BS}%%`);
  });

  it("escapes _ so a typed underscore is literal, not a one-character wildcard", () => {
    expect(containsPattern("a_b")).toBe(`%a${BS}_b%`);
  });

  it("escapes the backslash itself", () => {
    expect(containsPattern(`a${BS}b`)).toBe(`%a${BS}${BS}b%`);
  });

  it("escapes every metacharacter in a mixed string, not just the first", () => {
    expect(containsPattern("%_%")).toBe(`%${BS}%${BS}_${BS}%%`);
  });

  it("maps * to _ because PostgREST rewrites * to % even after a backslash", () => {
    expect(containsPattern("star*name")).toBe("%star_name%");
    expect(containsPattern("*")).toBe("%_%");
  });

  it("leaves an empty string as a bare contains pattern (callers skip empty queries)", () => {
    expect(containsPattern("")).toBe("%%");
  });

  it("does not touch other regex or SQL-looking characters", () => {
    expect(containsPattern("a.b(c)[d]'e")).toBe("%a.b(c)[d]'e%");
  });
});
