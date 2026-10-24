/** Wire types and labels for reviews, community, proposals and moderation (backend: docs/COMMUNITY.md). */

export type Author = { displayName: string };
export type Page = { page: number; pageSize: number; total: number; totalPages: number };

// ---- reviews -------------------------------------------------------------------

export type RatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;
export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  edited: boolean;
  author: Author;
  service: string;
  /** Derived by the server from a completed booking; never sent by a client. */
  verifiedBooking: boolean;
};
export type ReviewList = Page & {
  summary: { rating: number | null; reviewCount: number; distribution: RatingDistribution };
  reviews: PublicReview[];
};
export type OwnReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  canWithdraw: boolean;
  editableUntil: string;
};
/** The `review` part of a booking's detail. */
export type BookingReview =
  | { canReview: boolean; review: OwnReview | null }
  | { review: { rating: number; comment: string | null; createdAt: string } | null };

// ---- community -----------------------------------------------------------------

export type Post = {
  id: string;
  title: string;
  body: string;
  truncated: boolean;
  status: "VISIBLE" | "HIDDEN";
  author: Author;
  isMine: boolean;
  createdAt: string;
  editedAt: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};
export type PostList = Page & { posts: Post[] };
export type CommunityComment = { id: string; body: string; author: Author; isMine: boolean; createdAt: string; editedAt: string | null };
export type CommentList = Page & { comments: CommunityComment[] };

export type ProposalStatus = "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "DECLINED" | "PLANNED" | "COMPLETED";
export type Proposal = {
  id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  response: string | null;
  respondedAt: string | null;
  author: Author;
  isMine: boolean;
  createdAt: string;
  voteCount: number;
  votedByMe: boolean;
  votingOpen: boolean;
};
export type ProposalList = Page & { proposals: Proposal[] };

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  PLANNED: "Planned",
  COMPLETED: "Completed",
};
export const PROPOSAL_STATUS_MEANING: Record<ProposalStatus, string> = {
  SUBMITTED: "Waiting for the team. Voting is open.",
  UNDER_REVIEW: "The team is looking at it. Voting is open.",
  ACCEPTED: "Good idea; not scheduled yet. Voting is closed.",
  PLANNED: "Scheduled for building. Voting is closed.",
  COMPLETED: "Done. Voting is closed.",
  DECLINED: "Not going ahead. Voting is closed.",
};

// ---- reports -------------------------------------------------------------------

export type ReportTarget = "POST" | "COMMENT" | "REVIEW" | "PROPOSAL";
export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "ABUSE", label: "Abuse or harassment" },
  { value: "FRAUD", label: "Fake or misleading" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "PRIVACY", label: "Shares private information" },
  { value: "OTHER", label: "Something else" },
] as const;
export const REASON_LABELS: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

// ---- admin ---------------------------------------------------------------------

export type ReportStatus = "OPEN" | "REVIEWING" | "ACTIONED" | "DISMISSED";
export type ModerationTarget = {
  type: ReportTarget;
  id: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  author: string;
  title?: string;
  text: string;
  truncated: boolean;
  rating?: number;
  worker?: string | null;
  postId?: string;
  revisions?: { rating: number; comment: string | null; createdAt: string }[];
};
export type AdminReportRow = {
  id: string;
  status: ReportStatus;
  reason: string;
  details: string | null;
  createdAt: string;
  reportsOnThisItem: number;
  target: ModerationTarget;
};
export type AdminReportList = Page & { reports: AdminReportRow[] };
export type AuditEntry = { id: string; action: string; targetType: string; targetId: string; metadata: Record<string, unknown> | null; createdAt: string; actor: string | null };
export type AdminReportDetail = {
  report: {
    id: string;
    status: ReportStatus;
    reason: string;
    details: string | null;
    createdAt: string;
    resolvedAt: string | null;
    decisionNote: string | null;
    decidedBy: string | null;
    reporter: Author;
    target: ModerationTarget;
    otherReports: { id: string; reason: string; status: ReportStatus; createdAt: string }[];
  };
  history: AuditEntry[];
};
export type ModerationOverview = {
  reports: { open: number; reviewing: number; openByType: Record<ReportTarget, number> };
  proposals: { submitted: number; needsReview: number; voteThreshold: number };
  hidden: { posts: number; comments: number; reviews: number; proposals: number };
  visible: { reviews: number; posts: number };
};
export type AdminProposal = {
  id: string;
  title: string;
  description: string;
  status: ProposalStatus;
  visibility: "VISIBLE" | "HIDDEN" | "DELETED";
  response: string | null;
  author: Author;
  createdAt: string;
  voteCount: number;
  openReports: number;
  reachedThreshold: boolean;
  allowedNext: ProposalStatus[];
};
export type AdminProposalList = Page & { proposals: AdminProposal[]; voteThreshold: number };
export type AuditList = Page & { entries: AuditEntry[] };

export const AUDIT_LABELS: Record<string, string> = {
  "report.review": "Started reviewing a report",
  "report.resolve": "Resolved a report",
  "report.dismiss": "Dismissed a report",
  "content.hide": "Hid content",
  "content.restore": "Restored content",
  "proposal.status": "Changed a proposal's status",
};

export const CONTENT_PATH: Record<ReportTarget, string> = { POST: "posts", COMMENT: "comments", REVIEW: "reviews", PROPOSAL: "proposals" };
