"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

/** GET a backend resource and expose loading / error / unauthenticated states. */
export function useApi<T>(path: string) {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<T>(path)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: "unauthenticated" });
        } else {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Something went wrong.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);

  return { state, reload };
}

export type Me = {
  user: { id: string; name: string; email: string; emailVerified: boolean; image: string | null };
  isAdmin: boolean;
  customer: { onboarded: boolean; profile?: { displayName: string; preferredDivision: string | null } };
  worker: {
    started: boolean;
    approved: boolean;
    profile?: WorkerProfile;
  };
};

export type WorkerService = {
  pricingModel: "FIXED" | "HOURLY" | "QUOTE";
  basePriceBdt: number | null;
  pricingNotes: string | null;
  category: { slug: string; name: string };
};

export type WorkerProfile = {
  id: string;
  onboardingStatus: "DRAFT" | "SUBMITTED";
  onboardingStep: number;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  languages: string[];
  serviceAreas: string[];
  submittedAt: string | null;
  verificationStatus:
    | "NOT_SUBMITTED"
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "RESUBMISSION_REQUIRED";
  reviewNote: string | null;
  services: WorkerService[];
};

export const useMe = () => useApi<Me>("/me");
export const useAuthConfig = () =>
  useApi<{ googleEnabled: boolean; emailVerificationRequired: boolean; minPasswordLength: number }>(
    "/config/auth",
  );
