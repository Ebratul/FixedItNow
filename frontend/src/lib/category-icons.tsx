import {
  AirVent,
  Bug,
  Hammer,
  Laptop,
  LayoutGrid,
  Paintbrush,
  Plug,
  Sparkles,
  Truck,
  WashingMachine,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons are PRESENTATION only. Category names, descriptions, activity and
 * worker counts come from the database through the API; unknown slugs fall
 * back to a generic icon, so adding a category never needs a code change.
 */
const ICONS: Record<string, LucideIcon> = {
  electrical: Plug,
  plumbing: Wrench,
  "ac-repair": AirVent,
  "home-cleaning": Sparkles,
  "appliance-repair": WashingMachine,
  painting: Paintbrush,
  carpentry: Hammer,
  "moving-shifting": Truck,
  "pest-control": Bug,
  "computer-it": Laptop,
};

export function iconForCategory(slug: string): LucideIcon {
  return ICONS[slug] ?? LayoutGrid;
}

/** Renders the icon for a category slug (generic icon for unknown slugs). */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS[slug] ?? LayoutGrid;
  return <Icon className={className} aria-hidden />;
}

/**
 * Decorative shortcuts for the header menu and hero illustration. These are
 * links into real category pages (which 404 if a category is deactivated);
 * the hero panel is aria-hidden and makes no claims about availability.
 */
export const FEATURED_CATEGORIES = [
  { slug: "electrical", name: "Electrical Services" },
  { slug: "plumbing", name: "Plumbing" },
  { slug: "ac-repair", name: "AC Repair & Servicing" },
  { slug: "home-cleaning", name: "Home Cleaning" },
  { slug: "appliance-repair", name: "Appliance Repair" },
  { slug: "painting", name: "Painting" },
] as const;
