"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import { focusFirstInvalid } from "@/lib/focus";
import { DIVISIONS, isDivision } from "@/lib/locations";
import type { Me } from "@/lib/use-api";
import { fieldErrorsOf, formValues } from "@/lib/validation";

const schema = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters").max(60, "Use 60 characters or fewer"),
  preferredDivision: z.string().refine((v) => v === "" || isDivision(v), "Choose a valid division"),
});

function Form({ me }: { me: Me }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const profile = me.customer.profile;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = schema.safeParse(formValues(event.currentTarget));
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setFormError(undefined);
    setPending(true);
    try {
      await api("/me/customer-profile", {
        method: "PUT",
        body: {
          displayName: parsed.data.displayName,
          preferredDivision: parsed.data.preferredDivision || null,
        },
      });
      router.push("/account");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-8 max-w-lg space-y-5">
      <TextInput
        id="customer-name"
        name="displayName"
        label="Display name"
        hint="How professionals will see your name."
        defaultValue={profile?.displayName ?? me.user.name}
        autoComplete="name"
        maxLength={60}
        error={errors.displayName}
        disabled={pending}
      />
      <SelectInput
        id="customer-division"
        name="preferredDivision"
        label="Preferred location (optional)"
        placeholder="No preference"
        options={DIVISIONS}
        defaultValue={profile?.preferredDivision ?? ""}
        error={errors.preferredDivision}
        disabled={pending}
      />
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" size="lg" loading={pending}>
        {pending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}

export function CustomerOnboarding() {
  return (
    <AuthGate>
      {(me) => (
        <div>
          <h1 className="text-h1 font-extrabold text-brand-950">Set up your customer profile</h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-muted">
            Just the basics. We don&apos;t ask for payment or identity details here.
          </p>
          <Form me={me} />
        </div>
      )}
    </AuthGate>
  );
}
