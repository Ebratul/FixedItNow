export type KnowledgeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AiStatus = {
  service: { configured: boolean; reachable: boolean; llm: string | null; assistantEnabled: boolean };
  knowledge: {
    published: number;
    draft: number;
    archived: number;
    expectedDigest: string;
    running: { source: string; configuredSource: string; documents: number; chunks: number; digest: string } | null;
    inSync: boolean;
    lastSync: { ok: boolean; at: string; by: string; detail: unknown } | null;
  };
};

export type SyncResult = { synced: boolean; inSync: boolean; source: string; documents: number; chunks: number; hint: string | null };

export type KnowledgeRow = {
  id: string;
  slug: string;
  title: string;
  url: string;
  status: KnowledgeStatus;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
  characters: number;
  allowedNext: KnowledgeStatus[];
};

export type KnowledgeDocument = Omit<KnowledgeRow, "characters"> & {
  body: string;
  revisions: { version: number; title: string; createdAt: string }[];
};

export const KNOWLEDGE_STATUS: Record<KnowledgeStatus, { label: string; tone: "neutral" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", tone: "warning" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export const BODY_MIN = 20;
export const BODY_MAX = 20_000;
