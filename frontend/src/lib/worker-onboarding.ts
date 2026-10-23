import { z } from "zod";
import { DIVISIONS } from "./locations";
import type { WorkerProfile } from "./use-api";

export const LANGUAGES = ["Bangla", "English", "Hindi", "Urdu"] as const;
export const MAX_SERVICES = 5;
export const STEP_TITLES = [
  "Basics",
  "Services & pricing",
  "Experience",
  "Service areas",
  "Review",
] as const;

export type PricingModel = "FIXED" | "HOURLY" | "QUOTE";
export const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: "FIXED", label: "Fixed price per job" },
  { value: "HOURLY", label: "Hourly rate" },
  { value: "QUOTE", label: "Quote after inspection" },
];

export type ServiceDraft = {
  categorySlug: string;
  pricingModel: PricingModel;
  basePriceBdt: string;
  pricingNotes: string;
};

export type WorkerDraft = {
  displayName: string;
  headline: string;
  languages: string[];
  services: ServiceDraft[];
  experienceYears: string;
  bio: string;
  serviceAreas: string[];
};

export function draftFromProfile(profile: WorkerProfile | undefined, fallbackName: string): WorkerDraft {
  return {
    displayName: profile?.displayName ?? fallbackName,
    headline: profile?.headline ?? "",
    languages: profile?.languages ?? [],
    services: (profile?.services ?? []).map((s) => ({
      categorySlug: s.category.slug,
      pricingModel: s.pricingModel,
      basePriceBdt: s.basePriceBdt?.toString() ?? "",
      pricingNotes: s.pricingNotes ?? "",
    })),
    experienceYears: profile?.experienceYears?.toString() ?? "",
    bio: profile?.bio ?? "",
    serviceAreas: profile?.serviceAreas ?? [],
  };
}

const basics = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters").max(60, "Use 60 characters or fewer"),
  headline: z.string().trim().max(80, "Use 80 characters or fewer"),
  languages: z.array(z.string()).min(1, "Choose at least one language"),
});

const serviceSchema = z
  .object({
    categorySlug: z.string(),
    pricingModel: z.enum(["FIXED", "HOURLY", "QUOTE"]),
    basePriceBdt: z.string().trim(),
    pricingNotes: z.string().trim().max(300, "Use 300 characters or fewer"),
  })
  .superRefine((s, ctx) => {
    if (s.pricingModel === "QUOTE") return;
    const n = Number(s.basePriceBdt);
    if (s.basePriceBdt === "" || !Number.isInteger(n)) {
      ctx.addIssue({ code: "custom", path: ["basePriceBdt"], message: "Enter a whole-taka price" });
    } else if (n < 50 || n > 1_000_000) {
      ctx.addIssue({ code: "custom", path: ["basePriceBdt"], message: "Enter a price between ৳50 and ৳1,000,000" });
    }
  });

const services = z.object({
  services: z
    .array(serviceSchema)
    .min(1, "Add at least one service")
    .max(MAX_SERVICES, `Choose at most ${MAX_SERVICES} services`),
});

const experience = z.object({
  experienceYears: z
    .string()
    .trim()
    .refine((v) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 60, "Enter whole years between 0 and 60"),
  bio: z
    .string()
    .trim()
    .min(30, "Describe your work in at least 30 characters")
    .max(1000, "Use 1000 characters or fewer"),
});

const areas = z.object({
  serviceAreas: z.array(z.enum(DIVISIONS)).min(1, "Choose at least one service area"),
});

export const STEP_SCHEMAS = [basics, services, experience, areas] as const;

/** Validate one step (1-4). Keys use dotted paths, e.g. `services.0.basePriceBdt`. */
export function validateStep(step: number, draft: WorkerDraft): Record<string, string> {
  const schema = STEP_SCHEMAS[step - 1];
  if (!schema) return {};
  const result = schema.safeParse(draft);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Request body to persist a step, exactly the fields the backend accepts. */
export function payloadForStep(step: number, draft: WorkerDraft, nextStep: number) {
  const onboardingStep = Math.min(5, nextStep);
  switch (step) {
    case 1:
      return {
        displayName: draft.displayName.trim(),
        headline: draft.headline.trim() || null,
        languages: draft.languages,
        onboardingStep,
      };
    case 2:
      return {
        services: draft.services.map((s) => ({
          categorySlug: s.categorySlug,
          pricingModel: s.pricingModel,
          basePriceBdt: s.pricingModel === "QUOTE" ? null : Number(s.basePriceBdt),
          pricingNotes: s.pricingNotes.trim() || null,
        })),
        onboardingStep,
      };
    case 3:
      return {
        experienceYears: Number(draft.experienceYears),
        bio: draft.bio.trim(),
        onboardingStep,
      };
    default:
      return { serviceAreas: draft.serviceAreas, onboardingStep };
  }
}
