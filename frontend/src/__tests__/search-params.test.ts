import { describe, expect, it } from "vitest";
import { activeFilters, hrefWith, parseDirectoryParams, toQueryString } from "@/lib/search-params";

describe("parseDirectoryParams", () => {
  it("applies defaults for an empty query", () => {
    expect(parseDirectoryParams({})).toEqual({ params: { sort: "newest", page: 1 }, hadInvalid: false });
  });

  it("accepts valid values", () => {
    const { params, hadInvalid } = parseDirectoryParams({
      q: "  wiring ", category: "electrical", location: "Dhaka", maxPrice: "500", minExperience: "3", sort: "price_asc", page: "2",
    });
    expect(hadInvalid).toBe(false);
    expect(params).toEqual({ q: "wiring", category: "electrical", location: "Dhaka", maxPrice: 500, minExperience: 3, sort: "price_asc", page: 2 });
  });

  it("drops invalid values, flags them, and never throws", () => {
    const { params, hadInvalid } = parseDirectoryParams({
      q: "x".repeat(81), category: "BAD CAT", location: "Atlantis", maxPrice: "10", minExperience: "99", sort: "id; DROP", page: "0",
    });
    expect(hadInvalid).toBe(true);
    expect(params).toEqual({ sort: "newest", page: 1 });
  });

  it("rejects non-integers and takes the first of repeated params", () => {
    expect(parseDirectoryParams({ maxPrice: "5.5" }).params.maxPrice).toBeUndefined();
    expect(parseDirectoryParams({ maxPrice: "1e3" }).params.maxPrice).toBeUndefined();
    expect(parseDirectoryParams({ location: ["Dhaka", "Sylhet"] }).params.location).toBe("Dhaka");
  });

  it("treats blank values as absent, not invalid", () => {
    expect(parseDirectoryParams({ q: "   ", location: "", maxPrice: "" }).hadInvalid).toBe(false);
  });
});

describe("toQueryString / hrefWith", () => {
  const params = { q: "ac", location: "Dhaka" as const, sort: "newest" as const, page: 1 };

  it("omits defaults and empty values", () => {
    expect(toQueryString(params)).toBe("q=ac&location=Dhaka");
    expect(hrefWith("/workers", { sort: "newest", page: 1 })).toBe("/workers");
  });

  it("applies overrides, with null removing a key", () => {
    expect(toQueryString(params, { page: 3, sort: "experience" })).toBe("q=ac&location=Dhaka&sort=experience&page=3");
    expect(toQueryString(params, { location: null })).toBe("q=ac");
  });

  it("URL-encodes user text so it cannot inject extra params", () => {
    const qs = toQueryString({ ...params, q: "a&sort=price_asc#x" });
    expect(new URLSearchParams(qs).get("q")).toBe("a&sort=price_asc#x");
    expect(new URLSearchParams(qs).get("sort")).toBeNull();
  });

  it("can keep defaults for backend requests", () => {
    expect(toQueryString(params, {}, { keepDefaults: true })).toContain("sort=newest");
  });
});

describe("activeFilters", () => {
  it("lists only applied filters, using category names", () => {
    const chips = activeFilters(
      { q: "wiring", category: "electrical", location: "Dhaka", maxPrice: 1500, minExperience: 5, sort: "experience", page: 2 },
      (slug) => (slug === "electrical" ? "Electrical Services" : undefined),
      { includeCategory: true },
    );
    expect(chips.map((c) => c.key)).toEqual(["q", "category", "location", "maxPrice", "minExperience"]);
    expect(chips.find((c) => c.key === "category")?.label).toBe("Electrical Services");
    expect(chips.find((c) => c.key === "maxPrice")?.label).toContain("1,500");
  });
  it("hides the category chip on a category page", () => {
    expect(activeFilters({ category: "electrical", sort: "newest", page: 1 }, () => "x", { includeCategory: false })).toEqual([]);
  });
});
