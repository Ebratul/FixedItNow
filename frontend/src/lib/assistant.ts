import { ApiError } from "./api";
import type { WorkerCardData } from "./discovery-types";
import { formatBdt } from "./format";
import { isDivision, type Division } from "./locations";

/**
 * Wire types for POST /api/v1/ai/chat. Worker facts live ONLY in
 * `recommendations[].worker`, which the main API re-reads from the database;
 * everything else is the assistant's interpretation of the request.
 */
export type AssistantIntent = {
  category?: string | null;
  location?: Division | null;
  maxBudgetBdt?: number | null;
  minExperienceYears?: number | null;
  sort?: "experience" | "price_asc" | "newest" | null;
  preferredTime?: string | null;
  problem?: string | null;
};

export type IntentField = "category" | "location" | "maxBudgetBdt" | "minExperienceYears";
export type IntentSource = "explicit" | "inferred" | "carried";
export type MatchCode = "CATEGORY" | "LOCATION" | "BUDGET" | "EXPERIENCE";
export type AssistantNote =
  | "AVAILABILITY_NOT_CHECKED"
  | "BOOKING_NOT_SUPPORTED"
  | "INTENT_INFERRED"
  | "SIMPLE_MODE"
  | "CONTACT_DETAILS_PRIVATE";

export type AssistantResponse = {
  kind: "results" | "no_results" | "clarification" | "answer" | "out_of_scope" | "refused";
  message: string;
  language: "en" | "bn";
  intent: AssistantIntent;
  intentSources: Record<string, IntentSource>;
  clarification: {
    field: "category" | "location";
    question: string;
    options: { value: string; label: string }[];
    blocking: boolean;
  } | null;
  recommendations: { rank: number; matchedOn: MatchCode[]; worker: WorkerCardData }[];
  total: number | null;
  relaxations: { drop: "category" | "location" | "max_budget_bdt" | "min_experience_years"; matchCount: number }[];
  answer: { text: string; grounded: boolean; sources: { id: string; title: string; url: string }[] } | null;
  notes: AssistantNote[];
  mode: "llm" | "simple" | "direct";
};

export type ChatPayload = {
  message: string;
  intent?: AssistantIntent;
  locale?: "auto" | "en" | "bn";
  action?: "message" | "search";
};

export const REFRESH_MESSAGE = "Update search";

export const SUGGESTIONS = [
  "I need an electrician in Sylhet",
  "আমার বাসার পানির পাইপে লিক হয়েছে, একজন plumber দরকার।",
  "I need an AC technician in Dhaka, preferably this weekend",
  "How do refunds work for a cancelled booking?",
] as const;

export const NOTE_TEXT: Record<AssistantNote, string> = {
  AVAILABILITY_NOT_CHECKED:
    "Search can't check availability. A professional confirms a time when you request a booking.",
  BOOKING_NOT_SUPPORTED:
    "I can't book, cancel or pay for you. Open a profile and use “Request a booking” to continue.",
  INTENT_INFERRED: "Filters marked “understood” were interpreted from your words. Remove any that are wrong.",
  SIMPLE_MODE:
    "The AI model wasn't used for this answer, so your words were matched with simple rules. Results still come from the live directory.",
  CONTACT_DETAILS_PRIVATE: "Contact details are never shared by the assistant.",
};

export const MATCH_TEXT: Record<MatchCode, string> = {
  CATEGORY: "Service",
  LOCATION: "Area",
  BUDGET: "Budget",
  EXPERIENCE: "Experience",
};

export const FIELD_KEYS: Record<"category" | "location" | "max_budget_bdt" | "min_experience_years", IntentField> = {
  category: "category",
  location: "location",
  max_budget_bdt: "maxBudgetBdt",
  min_experience_years: "minExperienceYears",
};

export type IntentChip = { field: IntentField; label: string; source: IntentSource | undefined };

/** Human labels for the filters in force. `categoryNames` maps slug -> name when known. */
export function intentChips(
  intent: AssistantIntent,
  sources: Record<string, IntentSource> = {},
  categoryNames: Record<string, string> = {},
): IntentChip[] {
  const chips: IntentChip[] = [];
  if (intent.category) chips.push({ field: "category", label: categoryNames[intent.category] ?? intent.category, source: sources.category });
  if (intent.location) chips.push({ field: "location", label: intent.location, source: sources.location });
  if (typeof intent.maxBudgetBdt === "number")
    chips.push({ field: "maxBudgetBdt", label: `Up to ${formatBdt(intent.maxBudgetBdt)}`, source: sources.max_budget_bdt });
  if (typeof intent.minExperienceYears === "number")
    chips.push({ field: "minExperienceYears", label: `${intent.minExperienceYears}+ yrs experience`, source: sources.min_experience_years });
  return chips;
}

export function withoutField(intent: AssistantIntent, field: IntentField): AssistantIntent {
  return { ...intent, [field]: null };
}

/** The current filters as a link to the ordinary directory search (the fallback when AI fails). */
export function directorySearchHref(intent: AssistantIntent): string {
  const params = new URLSearchParams();
  if (intent.category) params.set("category", intent.category);
  if (intent.location && isDivision(intent.location)) params.set("location", intent.location);
  if (typeof intent.maxBudgetBdt === "number") params.set("maxPrice", String(intent.maxBudgetBdt));
  if (typeof intent.minExperienceYears === "number") params.set("minExperience", String(intent.minExperienceYears));
  if (intent.sort === "experience" || intent.sort === "price_asc" || intent.sort === "newest") params.set("sort", intent.sort);
  const query = params.toString();
  return query ? `/workers?${query}` : "/workers";
}

/** User-safe text for a failed assistant call. The backend never sends internals. */
export function assistantErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "AI_NOT_CONFIGURED":
        return "The assistant isn't set up on this site yet. You can still use the normal search.";
      case "AI_RATE_LIMITED":
        return "You're sending requests too quickly. Please wait a moment and try again.";
      case "AI_TIMEOUT":
        return "The assistant took too long to answer.";
      case "AI_UNAVAILABLE":
        return "The assistant is unavailable right now.";
    }
    if (error.status === 401) return "Your session has ended. Please log in again.";
    if (error.status === 400) return "That message couldn't be sent. Check its length and try again.";
    if (error.status === 429) return "You're sending requests too quickly. Please wait a moment and try again.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
