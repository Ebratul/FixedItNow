export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationList = {
  notifications: NotificationItem[];
  unreadCount: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  publishedAt: string | null;
  endsAt: string | null;
};

/** Browser event the notifications page fires so the header bell updates without waiting for its next poll. */
export const UNREAD_EVENT = "fin:unread-count";

/**
 * In-app paths only, mirroring the server rule (backend notifications link check): a single leading "/", then URL-safe
 * characters. "https://x", "//host" and "javascript:" are all rejected.
 */
const IN_APP_PATH = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$/;
export const isInAppPath = (value: string | null | undefined): value is string => typeof value === "string" && value.length <= 200 && IN_APP_PATH.test(value);
