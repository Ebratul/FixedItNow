import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { filterCategories } from "@/lib/categories";
import { iconForCategory } from "@/lib/category-icons";
import { isDivision } from "@/lib/locations";
import { FOOTER_GROUPS, PRIMARY_NAV } from "@/lib/site";

const categories = [
  { slug: "electrical", name: "Electrical Services", description: "Wiring, switches and fans.", workerCount: 2 },
  { slug: "plumbing", name: "Plumbing", description: "Leaks, taps, pipes.", workerCount: 0 },
  { slug: "computer-it", name: "Computer & IT Support", description: "Laptop and network help.", workerCount: 1 },
];

describe("filterCategories", () => {
  it("returns everything for an empty query", () => {
    expect(filterCategories(categories, "  ")).toHaveLength(3);
  });
  it("matches name or description case-insensitively", () => {
    expect(filterCategories(categories, "LAPTOP").map((c) => c.slug)).toEqual(["computer-it"]);
    expect(filterCategories(categories, "plumb").map((c) => c.slug)).toEqual(["plumbing"]);
  });
  it("returns nothing for gibberish and never mutates the input", () => {
    expect(filterCategories(categories, "zzzzqq")).toEqual([]);
    expect(categories).toHaveLength(3);
  });
});

describe("category icons", () => {
  it("falls back to a generic icon for unknown slugs", () => {
    expect(iconForCategory("brand-new-category")).toBeDefined();
    expect(iconForCategory("plumbing")).not.toBe(iconForCategory("brand-new-category"));
  });
});

describe("locations", () => {
  it("accepts only known divisions", () => {
    expect(isDivision("Dhaka")).toBe(true);
    expect(isDivision("Atlantis")).toBe(false);
    expect(isDivision(undefined)).toBe(false);
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
