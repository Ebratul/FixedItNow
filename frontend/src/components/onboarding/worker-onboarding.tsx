"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { VERIFICATION_LABELS, VerificationBadge } from "@/components/account/worker-status";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { IdentityDocuments } from "@/components/onboarding/identity-documents";
import { ErrorState } from "@/components/ui/error-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { DIVISIONS } from "@/lib/locations";
import { useApi, type Me, type WorkerProfile } from "@/lib/use-api";
import {
  draftFromProfile,
  flattenCategories,
  LANGUAGES,
  MAX_SERVICES,
  payloadForStep,
  PRICING_MODELS,
  STEP_TITLES,
  validateStep,
  type CategoryOption,
  type PricingModel,
  type ServiceDraft,
  type WorkerDraft,
} from "@/lib/worker-onboarding";

type Category = CategoryOption;
type CategoryTree = { slug: string; name: string; description: string; subcategories?: CategoryTree[] };

export function WorkerOnboarding() {
  return (
    <AuthGate>{(me, reload) => <Loader me={me} onChanged={reload} />}</AuthGate>
  );
}

function Loader({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const { state, reload } = useApi<{ categories: CategoryTree[] }>("/categories");
  if (state.status === "loading") return <Skeleton className="h-96" />;
  if (state.status !== "ready") {
    return (
      <ErrorState action={<Button onClick={reload}>Try again</Button>}>
        We couldn&apos;t load the service categories.
      </ErrorState>
    );
  }
  return <Flow me={me} categories={flattenCategories(state.data.categories)} onChanged={onChanged} />;
}

function Flow({ me, categories, onChanged }: { me: Me; categories: Category[]; onChanged: () => void }) {
  const profile = me.worker.profile;
  const submitted = profile?.onboardingStatus === "SUBMITTED";
  const [editing, setEditing] = useState(false);

  if (profile && submitted && !editing) {
    return <StatusView profile={profile} onEdit={() => setEditing(true)} onChanged={onChanged} />;
  }
  return (
    <Wizard
      me={me}
      categories={categories}
      onChanged={onChanged}
      onSubmitted={() => setEditing(false)}
    />
  );
}

function PublicationCard({ profile, onChanged }: { profile: WorkerProfile; onChanged: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const published = profile.publishedAt !== null;

  async function change(action: "publish" | "unpublish") {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await api(`/me/worker-profile/${action}`, { method: "POST", body: {} });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (profile.suspendedAt) {
    return (
      <Alert tone="error" title="Your profile is suspended" className="mt-4">
        FixedItNow suspended this profile, so it is not public. Contact support once support channels are available.
      </Alert>
    );
  }
  return (
    <div className="mt-4 rounded-card border border-line p-4">
      <h3 className="font-bold">Public listing</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {published
          ? "Your profile is public. Customers can find it in search and save it to their favorites. They can only request bookings once you have set working hours."
          : "Your profile is approved but not public. Publish it to appear in search."}
      </p>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      <div className="mt-3 flex flex-wrap gap-3">
        {published ? (
          <>
            {profile.slug && (
              <LinkButton href={`/workers/${profile.slug}`} variant="secondary">
                View public profile
              </LinkButton>
            )}
            <Button variant="ghost" onClick={() => change("unpublish")} loading={pending}>
              Unpublish
            </Button>
          </>
        ) : (
          <Button variant="accent" onClick={() => change("publish")} loading={pending}>
            Publish profile
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusView({
  profile,
  onEdit,
  onChanged,
}: {
  profile: WorkerProfile;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const info = VERIFICATION_LABELS[profile.verificationStatus];
  const canResubmit = profile.verificationStatus === "RESUBMISSION_REQUIRED";
  return (
    <div className="max-w-2xl">
      <h1 className="text-h1 font-extrabold text-brand-950">Your worker profile</h1>
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Review status</h2>
          <VerificationBadge status={profile.verificationStatus} />
        </div>
        <p className="mt-3 text-ink-muted">{info.description}</p>
        {profile.reviewNote && (
          <Alert tone="info" title="Reviewer note" className="mt-4">
            {profile.reviewNote}
          </Alert>
        )}
        {profile.verificationStatus === "VERIFIED" && (
          <PublicationCard profile={profile} onChanged={onChanged} />
        )}
        <Alert tone="info" className="mt-4">
          Approval here means a reviewer checked your profile and any identity documents you uploaded.
        </Alert>
        {profile.verificationStatus !== "VERIFIED" && (
          <div className="mt-4">
            <IdentityDocuments />
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={onEdit} variant={canResubmit ? "primary" : "secondary"}>
            {canResubmit ? "Edit and resubmit" : "Edit details"}
          </Button>
          {profile.verificationStatus === "VERIFIED" && (
            <LinkButton href="/account/availability" variant="secondary">
              Set working hours
            </LinkButton>
          )}
          <LinkButton href="/account" variant="ghost">
            Back to account
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}

function Wizard({
  me,
  categories,
  onChanged,
  onSubmitted,
}: {
  me: Me;
  categories: Category[];
  onChanged: () => void;
  onSubmitted: () => void;
}) {
  const profile = me.worker.profile;
  const [draft, setDraft] = useState<WorkerDraft>(() => draftFromProfile(profile, me.user.name));
  const [step, setStep] = useState(() => Math.min(Math.max(profile?.onboardingStep ?? 1, 1), 5));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the step heading when the step changes (screen-reader friendly).
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<WorkerDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setFormError(undefined);
  };

  const canSubmit =
    !profile ||
    profile.verificationStatus === "NOT_SUBMITTED" ||
    profile.verificationStatus === "RESUBMISSION_REQUIRED";

  async function save(target: number) {
    setPending(true);
    setFormError(undefined);
    try {
      await api("/me/worker-profile", { method: "PUT", body: payloadForStep(step, draft, target) });
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      return false;
    } finally {
      setPending(false);
    }
  }

  async function next() {
    if (pending) return;
    const found = validateStep(step, draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (await save(step + 1)) setStep(step + 1);
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    setFormError(undefined);
    try {
      await api("/me/worker-profile/submit", { method: "POST", body: {} });
      onChanged();
      onSubmitted();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-h1 font-extrabold text-brand-950">Set up your worker profile</h1>
      <p className="mt-3 text-lg text-ink-muted">
        Your progress is saved at every step, so you can leave and come back.
      </p>

      <nav aria-label="Progress" className="mt-8">
        <p className="text-sm font-semibold text-ink-muted">
          Step {step} of {STEP_TITLES.length}: {STEP_TITLES[step - 1]}
        </p>
        <ol className="mt-3 grid grid-cols-5 gap-2">
          {STEP_TITLES.map((title, index) => {
            const n = index + 1;
            return (
              <li
                key={title}
                aria-current={n === step ? "step" : undefined}
                className={cn(
                  "h-1.5 rounded-full",
                  n < step ? "bg-accent-600" : n === step ? "bg-brand-700" : "bg-line",
                )}
              >
                <span className="sr-only">
                  {title}
                  {n < step ? " (completed)" : n === step ? " (current)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="mt-6 p-6">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
          {STEP_TITLES[step - 1]}
        </h2>
        <div className="mt-6 space-y-6">
          {step === 1 && <BasicsStep draft={draft} errors={errors} update={update} disabled={pending} />}
          {step === 2 && (
            <ServicesStep draft={draft} errors={errors} update={update} categories={categories} disabled={pending} />
          )}
          {step === 3 && <ExperienceStep draft={draft} errors={errors} update={update} disabled={pending} />}
          {step === 4 && (
            <CheckboxGroup
              legend="Which divisions do you serve?"
              name="serviceAreas"
              options={DIVISIONS.map((d) => ({ value: d, label: d }))}
              value={draft.serviceAreas}
              onChange={(serviceAreas) => update({ serviceAreas })}
              error={errors.serviceAreas}
              disabled={pending}
            />
          )}
          {step === 5 && <ReviewStep draft={draft} categories={categories} />}
          {step === 5 && <IdentityDocuments />}

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Button>
            ) : (
              <Link href="/onboarding" className="text-sm font-semibold text-brand-700 hover:underline">
                Back to choices
              </Link>
            )}
            {step < 5 ? (
              <Button onClick={next} loading={pending}>
                {pending ? "Saving…" : "Save and continue"}
                {!pending && <ArrowRight className="size-4" aria-hidden />}
              </Button>
            ) : canSubmit ? (
              <Button variant="accent" onClick={submit} loading={pending}>
                {pending ? "Submitting…" : "Submit for review"}
                {!pending && <Send className="size-4" aria-hidden />}
              </Button>
            ) : (
              <LinkButton href="/account">
                <Check className="size-4" aria-hidden /> Done
              </LinkButton>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

type StepProps = {
  draft: WorkerDraft;
  errors: Record<string, string>;
  update: (patch: Partial<WorkerDraft>) => void;
  disabled: boolean;
};

function BasicsStep({ draft, errors, update, disabled }: StepProps) {
  return (
    <>
      <TextInput
        id="w-name"
        label="Display name"
        hint="The name customers will see."
        value={draft.displayName}
        onChange={(e) => update({ displayName: e.target.value })}
        error={errors.displayName}
        maxLength={60}
        disabled={disabled}
      />
      <TextInput
        id="w-headline"
        label="Headline (optional)"
        hint="e.g. Licensed electrician, 10 years in Dhaka"
        value={draft.headline}
        onChange={(e) => update({ headline: e.target.value })}
        error={errors.headline}
        maxLength={80}
        disabled={disabled}
      />
      <CheckboxGroup
        legend="Languages you work in"
        name="languages"
        options={LANGUAGES.map((l) => ({ value: l, label: l }))}
        value={draft.languages}
        onChange={(languages) => update({ languages })}
        error={errors.languages}
        disabled={disabled}
      />
    </>
  );
}

function ServicesStep({
  draft,
  errors,
  update,
  categories,
  disabled,
}: StepProps & { categories: Category[] }) {
  const selected = draft.services.map((s) => s.categorySlug);

  function toggle(slugs: string[]) {
    const kept = draft.services.filter((s) => slugs.includes(s.categorySlug));
    const added: ServiceDraft[] = slugs
      .filter((slug) => !selected.includes(slug))
      .map((categorySlug) => ({ categorySlug, pricingModel: "QUOTE", basePriceBdt: "", pricingNotes: "" }));
    update({ services: [...kept, ...added] });
  }

  function patch(slug: string, change: Partial<ServiceDraft>) {
    update({
      services: draft.services.map((s) => (s.categorySlug === slug ? { ...s, ...change } : s)),
    });
  }

  return (
    <>
      <CheckboxGroup
        legend={`Which services do you offer? (up to ${MAX_SERVICES})`}
        name="services"
        options={categories.map((c) => ({ value: c.slug, label: c.name }))}
        value={selected}
        onChange={toggle}
        error={errors.services}
        disabled={disabled}
      />
      {draft.services.map((service, index) => {
        const name = categories.find((c) => c.slug === service.categorySlug)?.name ?? service.categorySlug;
        const base = `services.${index}`;
        return (
          <fieldset key={service.categorySlug} className="rounded-card border border-line p-4" disabled={disabled}>
            <legend className="px-1 text-sm font-bold">{name}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput
                id={`price-model-${service.categorySlug}`}
                label="Pricing"
                placeholder="Choose…"
                options={PRICING_MODELS}
                value={service.pricingModel}
                onChange={(e) => patch(service.categorySlug, { pricingModel: e.target.value as PricingModel })}
              />
              {service.pricingModel !== "QUOTE" && (
                <TextInput
                  id={`price-${service.categorySlug}`}
                  label={service.pricingModel === "HOURLY" ? "Rate per hour (৳)" : "Base price (৳)"}
                  inputMode="numeric"
                  value={service.basePriceBdt}
                  onChange={(e) => patch(service.categorySlug, { basePriceBdt: e.target.value })}
                  error={errors[`${base}.basePriceBdt`]}
                />
              )}
            </div>
            <div className="mt-4">
              <TextInput
                id={`notes-${service.categorySlug}`}
                label="Pricing notes (optional)"
                hint="e.g. Parts are charged separately."
                value={service.pricingNotes}
                onChange={(e) => patch(service.categorySlug, { pricingNotes: e.target.value })}
                error={errors[`${base}.pricingNotes`]}
                maxLength={300}
              />
            </div>
          </fieldset>
        );
      })}
    </>
  );
}

function ExperienceStep({ draft, errors, update, disabled }: StepProps) {
  return (
    <>
      <TextInput
        id="w-exp"
        label="Years of experience"
        inputMode="numeric"
        value={draft.experienceYears}
        onChange={(e) => update({ experienceYears: e.target.value })}
        error={errors.experienceYears}
        disabled={disabled}
        className="max-w-40"
      />
      <TextArea
        id="w-bio"
        label="About your work"
        hint={`${draft.bio.trim().length}/1000 characters (at least 30).`}
        value={draft.bio}
        onChange={(e) => update({ bio: e.target.value })}
        error={errors.bio}
        maxLength={1000}
        disabled={disabled}
      />
    </>
  );
}

function ReviewStep({ draft, categories }: { draft: WorkerDraft; categories: Category[] }) {
  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  return (
    <>
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="font-semibold text-ink-muted">Name</dt>
        <dd>{draft.displayName}</dd>
        {draft.headline && (
          <>
            <dt className="font-semibold text-ink-muted">Headline</dt>
            <dd>{draft.headline}</dd>
          </>
        )}
        <dt className="font-semibold text-ink-muted">Languages</dt>
        <dd>{draft.languages.join(", ") || "—"}</dd>
        <dt className="font-semibold text-ink-muted">Services</dt>
        <dd>
          <ul className="space-y-1">
            {draft.services.map((s) => (
              <li key={s.categorySlug}>
                {nameOf(s.categorySlug)} ·{" "}
                {s.pricingModel === "QUOTE"
                  ? "Quote after inspection"
                  : `${s.pricingModel === "HOURLY" ? "৳" + s.basePriceBdt + "/hour" : "৳" + s.basePriceBdt}`}
              </li>
            ))}
          </ul>
        </dd>
        <dt className="font-semibold text-ink-muted">Experience</dt>
        <dd>{draft.experienceYears} years</dd>
        <dt className="font-semibold text-ink-muted">About</dt>
        <dd className="whitespace-pre-line">{draft.bio}</dd>
        <dt className="font-semibold text-ink-muted">Service areas</dt>
        <dd>{draft.serviceAreas.join(", ") || "—"}</dd>
      </dl>
      <Alert tone="info" title="What happens next">
        Submitting sends your profile to a reviewer. It is not approved or listed automatically, and
        you can still edit it. Identity documents are covered in the section below: it says whether they are required or optional.
      </Alert>
    </>
  );
}
