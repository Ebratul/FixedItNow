/** Response shapes of the admin people/governance endpoints (backend/src/admin/{users,roles,audit,settings}). */
export type PageInfo = { page: number; pageSize: number; total: number; totalPages: number };

export type AdminRoleRef = { id: string; key: string; name: string };
export type WorkerRef = { id: string; verificationStatus: string; published: boolean };

export type UserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "USER" | "ADMIN";
  adminRole: AdminRoleRef | null;
  suspended: boolean;
  createdAt: string;
  isCustomer: boolean;
  worker: WorkerRef | null;
};
export type UserList = PageInfo & { users: UserRow[] };

export type UserDetail = UserRow & {
  suspensionReason: string | null;
  updatedAt: string;
  customerProfile: { id: string; displayName: string | null; preferredDivision: string | null } | null;
  activeSessions: number;
  counts: { bookingsAsCustomer: number; bookingsAsWorker: number; supportTickets: number; reportsFiled: number; posts: number; reviews: number };
  recentActions: { id: string; action: string; createdAt: string; by: string; reason: string | null }[];
};

export type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  /** Stored permissions; `["*"]` for the super administrator role. */
  permissions: string[];
  effectivePermissions: string[];
  holders: number;
  createdAt: string;
  updatedAt: string;
};
export type RoleHolder = { id: string; name: string; email: string; suspended: boolean };
export type PermissionDef = { key: string; label: string; description: string; sensitive?: boolean };
export type PermissionGroup = { id: string; label: string; permissions: PermissionDef[] };

export type AuditEntry = {
  id: string;
  seq: number;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
  hash: string;
  actor: { id: string; name: string | null; email: string | null; removed?: boolean } | null;
};
export type AuditList = PageInfo & { entries: AuditEntry[] };
export type AuditVerify = {
  valid: boolean;
  checked: number;
  headSeq: number;
  headHash: string | null;
  firstInvalidSeq: number | null;
  problems: { contentChanged: boolean; chainBroken: boolean; gapOrReorder: boolean };
  checkedAt: string;
};

export type PlatformSetting = {
  key: string;
  group: string;
  label: string;
  description: string;
  effect: string;
  type: "boolean" | "number" | "string";
  value: boolean | number | string;
  default: boolean | number | string;
  isDefault: boolean;
  updatedAt: string | null;
};
