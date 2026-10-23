import { describe, expect, it } from "vitest";
import { SERVICE_CATEGORIES, filterCategories, getCategoryBySlug } from "@/lib/categories";
import { isDivision } from "@/lib/locations";
import { getFeaturedProfessionals, searchProfessionals } from "@/lib/professionals";
import { PRIMARY_NAV, FOOTER_GROUPS } from "@/lib/site";
import fs from "node:fs";
import path from "node:path";

describe("categories", () => {
  it("returns everything for an empty query", () => {
    expect(filterCategories("  ")).toHaveLength(SERVICE_CATEGORIES.length);
  });
  it("matches by keyword, case-insensitively", () => {
    expect(filterCategories("LAPTOP").map((c) => c.slug)).toEqual(["computer-it"]);
  });
  it("returns nothing for gibberish", () => {
    expect(filterCategories("zzzzqq")).toEqual([]);
  });
  it("looks categories up by slug", () => {
    expect(getCategoryBySlug("plumbing")?.name).toBe("Plumbing");
    expect(getCategoryBySlug("nope")).toBeUndefined();
  });
  it("has unique slugs", () => {
    const slugs = SERVICE_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("locations", () => {
  it("accepts only known divisions", () => {
    expect(isDivision("Dhaka")).toBe(true);
    expect(isDivision("Atlantis")).toBe(false);
    expect(isDivision(undefined)).toBe(false);
  });
});

describe("professionals data boundary", () => {
  it("never fabricates professionals", async () => {
    expect(await getFeaturedProfessionals()).toEqual([]);
    expect(await searchProfessionals({ q: "ac" })).toEqual([]);
  });
});

describe("navigation", () => {
  it("only links to routes that exist in src/app", () => {
    const hrefs = [...PRIMARY_NAV, ...FOOTER_GROUPS.flatMap((g) => g.links)].map((l) => l.href);
    for (const href of hrefs) {
      const dir = path.join(process.cwd(), "src/app", href === "/" ? "" : href);
      expect(fs.existsSync(path.join(dir, "page.tsx")), href).toBe(true);
    }
  });
});
