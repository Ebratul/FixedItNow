/**
 * Site-wide configuration shared by the header, footer, and metadata.
 * Only routes that exist in src/app may be listed here; keep this file and the
 * route tree in sync so navigation never contains dead links.
 */
export const SITE_NAME = "FixedItNow";

export const SITE_TAGLINE = "Trusted local professionals, one search away.";

export const SITE_DESCRIPTION =
  "FixedItNow helps customers in Bangladesh discover and hire trusted service professionals for home repairs, maintenance, and everyday services.";

/**
 * Canonical origin. Left unset until the production domain is known; metadata,
 * the sitemap, and robots only use it when NEXT_PUBLIC_SITE_URL is provided.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export type NavLink = { href: string; label: string };

export const PRIMARY_NAV: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/community", label: "Community" },
  { href: "/become-a-worker", label: "Become a worker" },
  { href: "/help", label: "Help" },
];

export const FOOTER_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Customers",
    links: [
      { href: "/services", label: "Browse services" },
      { href: "/workers", label: "Find professionals" },
      { href: "/assistant", label: "AI assistant" },
      { href: "/community", label: "Community" },
      { href: "/how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Professionals",
    links: [
      { href: "/become-a-worker", label: "Become a worker" },
      { href: "/register", label: "Create an account" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/help", label: "Help & FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export const AUTH_LINKS = {
  login: { href: "/login", label: "Log in" },
  signup: { href: "/register", label: "Sign up" },
} as const;
