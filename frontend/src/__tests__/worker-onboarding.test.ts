import { describe, expect, it } from "vitest";
import { draftFromProfile, payloadForStep, validateStep, type WorkerDraft } from "@/lib/worker-onboarding";

const draft: WorkerDraft = {
  displayName: "Rahim",
  headline: "",
  languages: ["Bangla"],
  services: [
    { categorySlug: "electrical", pricingModel: "FIXED", basePriceBdt: "500", pricingNotes: "" },
    { categorySlug: "ac-repair", pricingModel: "QUOTE", basePriceBdt: "", pricingNotes: "" },
  ],
  experienceYears: "8",
  bio: "Eight years of residential wiring and fan fitting.",
  serviceAreas: ["Dhaka"],
};

describe("validateStep", () => {
  it("passes a complete draft on every step", () => {
    for (const step of [1, 2, 3, 4]) expect(validateStep(step, draft)).toEqual({});
  });
  it("step 1 needs a name and a language", () => {
    expect(Object.keys(validateStep(1, { ...draft, displayName: "R", languages: [] })).sort()).toEqual(["displayName", "languages"]);
  });
  it("step 2 needs a service and a price for non-quote services", () => {
    expect(validateStep(2, { ...draft, services: [] }).services).toBeDefined();
    const errors = validateStep(2, { ...draft, services: [{ ...draft.services[0], basePriceBdt: "" }] });
    expect(errors["services.0.basePriceBdt"]).toBeDefined();
    expect(validateStep(2, { ...draft, services: [{ ...draft.services[0], basePriceBdt: "12.5" }] })["services.0.basePriceBdt"]).toBeDefined();
    expect(validateStep(2, { ...draft, services: [{ ...draft.services[0], basePriceBdt: "10" }] })["services.0.basePriceBdt"]).toBeDefined();
  });
  it("step 2 allows at most five services", () => {
    const many = ["a", "b", "c", "d", "e", "f"].map((categorySlug) => ({ categorySlug, pricingModel: "QUOTE" as const, basePriceBdt: "", pricingNotes: "" }));
    expect(validateStep(2, { ...draft, services: many }).services).toBeDefined();
  });
  it("step 3 checks experience and bio", () => {
    expect(validateStep(3, { ...draft, experienceYears: "-1", bio: "short" })).toMatchObject({ experienceYears: expect.any(String), bio: expect.any(String) });
  });
  it("step 4 needs an area", () => {
    expect(validateStep(4, { ...draft, serviceAreas: [] }).serviceAreas).toBeDefined();
  });
});

describe("payloadForStep", () => {
  const FORBIDDEN = ["verificationStatus", "onboardingStatus", "userId", "id", "role", "reviewedById", "reviewNote"];

  it("never sends fields a worker must not control", () => {
    for (const step of [1, 2, 3, 4]) {
      const payload = payloadForStep(step, draft, step + 1);
      for (const key of FORBIDDEN) expect(payload).not.toHaveProperty(key);
    }
  });
  it("converts blanks to null and numbers to numbers", () => {
    expect(payloadForStep(1, draft, 2)).toMatchObject({ headline: null, onboardingStep: 2 });
    const services = (payloadForStep(2, draft, 3) as { services: { basePriceBdt: number | null }[] }).services;
    expect(services.map((s) => s.basePriceBdt)).toEqual([500, null]);
    expect(payloadForStep(3, draft, 4)).toMatchObject({ experienceYears: 8 });
  });
  it("caps the progress step at 5", () => {
    expect(payloadForStep(4, draft, 9)).toMatchObject({ onboardingStep: 5 });
  });
});

describe("draftFromProfile", () => {
  it("falls back to the account name for a new profile", () => {
    expect(draftFromProfile(undefined, "Account Name").displayName).toBe("Account Name");
  });
});
