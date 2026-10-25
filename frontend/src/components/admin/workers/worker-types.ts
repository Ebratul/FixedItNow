import type { BadgeTone } from "@/components/ui/badge";

export type VerificationStatus = "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED" | "RESUBMISSION_REQUIRED";
export type DocumentKind = "NID_FRONT" | "NID_BACK" | "SELFIE_WITH_ID";

export const DOCUMENT_KINDS: readonly DocumentKind[] = ["NID_FRONT", "NID_BACK", "SELFIE_WITH_ID"];
export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  NID_FRONT: "National ID, front",
  NID_BACK: "National ID, back",
  SELFIE_WITH_ID: "Selfie holding the ID",
};

export const VERIFICATION_STATUS_MAP: Record<VerificationStatus, { label: string; tone: BadgeTone }> = {
  NOT_SUBMITTED: { label: "Not submitted", tone: "neutral" },
  PENDING: { label: "Awaiting review", tone: "warning" },
  VERIFIED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  RESUBMISSION_REQUIRED: { label: "Changes requested", tone: "warning" },
};

export type AdminWorkerRow = {
  id: string;
  displayName: string | null;
  email: string;
  submittedAt: string | null;
  verificationStatus: VerificationStatus;
  published: boolean;
  suspended: boolean;
  categories: string[];
  documentCount: number;
};

export type AdminWorkerList = { page: number; pageSize: number; total: number; totalPages: number; workers: AdminWorkerRow[] };

export type WorkerDocumentMeta = { kind: DocumentKind; mimeType: string; sizeBytes: number; uploadedAt: string };

export type WorkerHistoryEntry = { id: string; action: string; at: string; by: string; detail: Record<string, unknown> | null };

export type AdminWorkerDetail = {
  id: string;
  userId: string;
  onboardingStatus: "DRAFT" | "SUBMITTED";
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  languages: string[];
  serviceAreas: string[];
  submittedAt: string | null;
  verificationStatus: VerificationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
  slug: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  startingPriceBdt: number | null;
  published: boolean;
  suspended: boolean;
  services: { pricingModel: "FIXED" | "HOURLY" | "QUOTE"; basePriceBdt: number | null; category: { name: string; slug: string } }[];
  documents: WorkerDocumentMeta[];
  user: { id: string; name: string; email: string; suspended: boolean };
  isOwnProfile: boolean;
  documentsRequired: boolean;
  missingDocuments: DocumentKind[];
  history: WorkerHistoryEntry[];
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
