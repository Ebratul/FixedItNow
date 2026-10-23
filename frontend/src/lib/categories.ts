import {
  AirVent,
  Bug,
  Hammer,
  Laptop,
  Paintbrush,
  Plug,
  Sparkles,
  Truck,
  WashingMachine,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type ServiceCategory = {
  slug: string;
  name: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
};

/**
 * PRESENTATION-ONLY seed content.
 *
 * Categories are managed by admins in the database (docs/SRS.md FR-SVC-01), but
 * that API does not exist yet. Until it does, this list drives the public
 * pages. Listing a category here does NOT imply professionals are available for
 * it. Replace this module with an API-backed data source in the discovery step.
 */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: "electrical",
    name: "Electrical Services",
    description: "Wiring, switches, fans, lighting, and fault finding.",
    keywords: ["electrician", "wiring", "fan", "light", "switch", "power"],
    icon: Plug,
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    description: "Leaks, taps, pipes, drainage, and bathroom fittings.",
    keywords: ["plumber", "pipe", "leak", "tap", "water", "drain"],
    icon: Wrench,
  },
  {
    slug: "ac-repair",
    name: "AC Repair & Servicing",
    description: "Air conditioner servicing, gas refill, and repairs.",
    keywords: ["ac", "air conditioner", "cooling", "gas", "servicing"],
    icon: AirVent,
  },
  {
    slug: "home-cleaning",
    name: "Home Cleaning",
    description: "Deep cleaning for homes, kitchens, and bathrooms.",
    keywords: ["cleaning", "cleaner", "deep clean", "maid", "sanitise"],
    icon: Sparkles,
  },
  {
    slug: "appliance-repair",
    name: "Appliance Repair",
    description: "Fridges, washing machines, ovens, and other appliances.",
    keywords: ["fridge", "refrigerator", "washing machine", "oven", "microwave"],
    icon: WashingMachine,
  },
  {
    slug: "painting",
    name: "Painting",
    description: "Interior and exterior painting and wall finishing.",
    keywords: ["paint", "painter", "wall", "colour", "putty"],
    icon: Paintbrush,
  },
  {
    slug: "carpentry",
    name: "Carpentry",
    description: "Furniture repair, fittings, doors, and woodwork.",
    keywords: ["carpenter", "furniture", "wood", "door", "cabinet"],
    icon: Hammer,
  },
  {
    slug: "moving-shifting",
    name: "Moving & Shifting",
    description: "Packing, loading, and home or office relocation.",
    keywords: ["moving", "shifting", "relocation", "packing", "transport"],
    icon: Truck,
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    description: "Treatment for cockroaches, termites, rodents, and more.",
    keywords: ["pest", "termite", "cockroach", "rat", "insect"],
    icon: Bug,
  },
  {
    slug: "computer-it",
    name: "Computer & IT Support",
    description: "Laptop and desktop repair, networking, and setup help.",
    keywords: ["computer", "laptop", "wifi", "network", "software", "it"],
    icon: Laptop,
  },
];

export function getCategoryBySlug(
  slug: string | undefined,
): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((category) => category.slug === slug);
}

/** Case-insensitive match against a category's name, description, and keywords. */
export function filterCategories(query: string): ServiceCategory[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SERVICE_CATEGORIES;
  return SERVICE_CATEGORIES.filter((category) =>
    [category.name, category.description, ...category.keywords].some((text) =>
      text.toLowerCase().includes(needle),
    ),
  );
}
