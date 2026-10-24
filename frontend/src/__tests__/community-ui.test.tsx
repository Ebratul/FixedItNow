import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/community/p1",
}));
let session: { user: { id: string } } | null = { user: { id: "u1" } };
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: session, isPending: false }) } }));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
let isAdmin = true;
const data: Record<string, unknown> = {};
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: { isAdmin } }, reload: vi.fn() }),
  useApi: (path: string) => {
    const key = Object.keys(data).find((k) => path.startsWith(k));
    return { state: key ? { status: "ready", data: data[key] } : { status: "loading" }, reload: vi.fn() };
  },
}));

import { ApiError } from "@/lib/api";
import { ModerationView } from "@/components/admin/moderation-view";
import { PostView } from "@/components/community/post-view";
import { ProposalsView } from "@/components/community/proposals";
import { ReportButton } from "@/components/community/report-button";
import { ReviewPanel } from "@/components/reviews/review-panel";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import type { BookingReview, Post } from "@/lib/community";

const page = { page: 1, pageSize: 10, total: 1, totalPages: 1 };
const own = (over: object = {}) => ({
  id: "r1", rating: 4, comment: "Good", status: "VISIBLE" as const, createdAt: "2026-11-01T06:00:00Z", editedAt: null,
  canEdit: true, canWithdraw: true, editableUntil: "2026-11-15T06:00:00Z", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.mockReset();
  session = { user: { id: "u1" } };
  isAdmin = true;
  for (const k of Object.keys(data)) delete data[k];
});

describe("public reviews", () => {
  it("shows server-derived verified bookings, public first names and a breakdown", () => {
    data["/workers/rahim/reviews"] = {
      ...page, total: 2,
      summary: { rating: 4.5, reviewCount: 2, distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 } },
      reviews: [
        { id: "a", rating: 5, comment: "<b>Great</b> work", createdAt: "2026-11-01T06:00:00Z", edited: false, author: { displayName: "Asha" }, service: "Electrical Services", verifiedBooking: true },
        { id: "b", rating: 4, comment: null, createdAt: "2026-11-02T06:00:00Z", edited: true, author: { displayName: "Karim" }, service: "Electrical Services", verifiedBooking: true },
      ],
    };
    const { container } = render(<ReviewsSection slug="rahim" rating={4.5} reviewCount={2} />);
    expect(screen.getAllByText("Verified booking")).toHaveLength(2);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText(/<b>Great<\/b> work/)).toBeInTheDocument(); // plain text, not markup
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/edited/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: undefined })).toBeTruthy();
    expect(screen.getByLabelText("Rating breakdown")).toBeInTheDocument();
  });

  it("is honest when there are no reviews", () => {
    data["/workers/new/reviews"] = { ...page, total: 0, totalPages: 0, summary: { rating: null, reviewCount: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } }, reviews: [] };
    render(<ReviewsSection slug="new" rating={null} reviewCount={0} />);
    expect(screen.getAllByText(/No reviews yet/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Verified booking")).not.toBeInTheDocument();
  });
});

describe("review panel", () => {
  it("offers the form only when the server says the customer can review, and posts what was entered", async () => {
    const onChanged = vi.fn();
    api.mockResolvedValueOnce({ review: own({ rating: 5, comment: "Excellent" }) });
    render(<ReviewPanel bookingId="b1" workerName="Rahim" data={{ canReview: true, review: null }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Post review" }));
    expect(await screen.findByText("Choose a rating from 1 to 5.")).toBeInTheDocument(); // client hint only
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("5 stars"));
    fireEvent.change(screen.getByLabelText("Your review (optional)"), { target: { value: "Excellent" } });
    fireEvent.click(screen.getByRole("button", { name: "Post review" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/bookings/b1/review", { method: "POST", body: { rating: 5, comment: "Excellent" } }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ canReview: false, review: expect.objectContaining({ rating: 5 }) })));
  });

  it("renders nothing for an ineligible booking, and shows the server's rejection", async () => {
    const { container } = render(<ReviewPanel bookingId="b1" workerName="Rahim" data={{ canReview: false, review: null }} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    api.mockRejectedValueOnce(new ApiError(422, "You can review a booking once the job is completed", {}, "BOOKING_NOT_REVIEWABLE"));
    render(<ReviewPanel bookingId="b2" workerName="Rahim" data={{ canReview: true, review: null }} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("3 stars"));
    fireEvent.click(screen.getByRole("button", { name: "Post review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("once the job is completed");
  });

  it("explains moderated and withdrawn reviews and hides edit controls the server did not grant", () => {
    render(<ReviewPanel bookingId="b1" workerName="Rahim" data={{ canReview: false, review: own({ status: "HIDDEN", canEdit: false, canWithdraw: false }) }} onChanged={vi.fn()} />);
    expect(screen.getByText("Removed by moderators")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it("shows the professional a visible review read-only", () => {
    const data: BookingReview = { review: { rating: 4, comment: "Nice", createdAt: "2026-11-01T06:00:00Z" } };
    render(<ReviewPanel bookingId="b1" workerName="Rahim" data={data} onChanged={vi.fn()} />);
    expect(screen.getByText("Nice")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("confirms before withdrawing", async () => {
    const onChanged = vi.fn();
    api.mockResolvedValueOnce({ review: own({ status: "DELETED", canEdit: false, canWithdraw: false }) });
    render(<ReviewPanel bookingId="b1" workerName="Rahim" data={{ canReview: false, review: own() }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw review" }));
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Withdraw review", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/bookings/b1/review", { method: "DELETE" }));
  });
});

describe("report button", () => {
  it("sends signed-out visitors to log in, and never calls the API", () => {
    session = null;
    render(<ReportButton type="POST" id="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /report/i }));
    expect(push).toHaveBeenCalledWith("/login?next=%2Fcommunity%2Fp1");
    expect(api).not.toHaveBeenCalled();
  });

  it("requires a reason, then reports; reviews use their own route", async () => {
    api.mockResolvedValue({ report: { id: "r", status: "OPEN" } });
    render(<ReportButton type="REVIEW" id="rev1" label="Report review" />);
    fireEvent.click(screen.getByRole("button", { name: /report review/i }));
    fireEvent.click(screen.getByRole("button", { name: "Send report", hidden: true }));
    expect(await screen.findByText("Choose a reason.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "FRAUD" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/reviews/rev1/report", { method: "POST", body: { reason: "FRAUD" } }));
    expect(await screen.findByText(/Nothing is removed automatically/)).toBeInTheDocument();
  });

  it("shows the server's message when it was already reported", async () => {
    api.mockRejectedValue(new ApiError(409, "You have already reported this content", {}, "ALREADY_REPORTED"));
    render(<ReportButton type="POST" id="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /report/i }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "SPAM" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report", hidden: true }));
    expect(await screen.findByText("You have already reported this content")).toBeInTheDocument();
  });
});

const post = (over: Partial<Post> = {}): Post => ({
  id: "p1", title: "Fan tips", body: "<script>alert(1)</script>\nSecond line", truncated: false, status: "VISIBLE", author: { displayName: "Asha" },
  isMine: false, createdAt: "2026-11-01T06:00:00Z", editedAt: null, likeCount: 2, commentCount: 1, likedByMe: false, ...over,
});

describe("post view", () => {
  it("renders post text as text, likes from the server's count, and offers report (not edit) on others' posts", async () => {
    data["/community/posts/p1/comments"] = { ...page, comments: [{ id: "c1", body: "Try <i>this</i>", author: { displayName: "Bina" }, isMine: false, createdAt: "2026-11-01T07:00:00Z", editedAt: null }] };
    data["/community/posts/p1"] = { post: post() };
    api.mockResolvedValueOnce({ reacted: true, likeCount: 3 });
    const { container } = render(<PostView id="p1" />);
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("i")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /report post/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Like/ }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/community/posts/p1/reactions", { method: "POST", body: { type: "LIKE" } }));
    expect(await screen.findByRole("button", { name: /Liked · 3/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the removed state to the author and no edit/delete/comment form", () => {
    data["/community/posts/p1"] = { post: post({ isMine: true, status: "HIDDEN" }) };
    render(<PostView id="p1" />);
    expect(screen.getAllByText(/Removed by moderators/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add a comment")).not.toBeInTheDocument();
  });
});

describe("proposals", () => {
  const proposal = (over: object = {}) => ({
    id: "pr1", title: "Dark theme", description: "Please", status: "SUBMITTED", response: null, respondedAt: null, author: { displayName: "Dev" },
    isMine: false, createdAt: "2026-11-01T06:00:00Z", voteCount: 4, votedByMe: false, votingOpen: true, ...over,
  });

  it("votes with the server's count, and disables voting once closed", async () => {
    data["/feature-proposals"] = { ...page, proposals: [proposal(), proposal({ id: "pr2", title: "Old idea", status: "DECLINED", votingOpen: false, response: "Not now." })] };
    api.mockResolvedValueOnce({ voted: true, voteCount: 5 });
    render(<ProposalsView />);
    fireEvent.click(screen.getByRole("button", { name: "Vote for Dark theme" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/feature-proposals/pr1/vote", { method: "POST" }));
    expect(await screen.findByRole("button", { name: "Remove your vote from Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("5 votes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vote for Old idea" })).toBeDisabled();
    expect(screen.getByText("Not now.")).toBeInTheDocument();
    expect(screen.getByText(/does not build or switch anything on by itself/)).toBeInTheDocument();
  });

  it("shows the server's error when a vote is refused", async () => {
    data["/feature-proposals"] = { ...page, proposals: [proposal()] };
    api.mockRejectedValueOnce(new ApiError(409, "Voting on this proposal has closed", {}, "VOTING_CLOSED"));
    render(<ProposalsView />);
    fireEvent.click(screen.getByRole("button", { name: "Vote for Dark theme" }));
    expect(await screen.findByText("Voting on this proposal has closed")).toBeInTheDocument();
  });
});

describe("moderation console", () => {
  const overview = { reports: { open: 1, reviewing: 0, openByType: { POST: 1, COMMENT: 0, REVIEW: 0, PROPOSAL: 0 } }, proposals: { submitted: 2, needsReview: 1, voteThreshold: 10 }, hidden: { posts: 0, comments: 0, reviews: 0, proposals: 0 }, visible: { reviews: 3, posts: 4 } };
  const target = { type: "POST", id: "p1", status: "VISIBLE", author: "Asha", title: "Cheap deal", text: "call me", truncated: false };

  it("tells non-admins they have no access without calling any admin API", () => {
    isAdmin = false;
    render(<ModerationView />);
    expect(screen.getByText("Administrators only")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("requires a note, resolves without touching content unless chosen, and sends the explicit content action", async () => {
    data["/admin/moderation/overview"] = overview;
    data["/admin/reports/r1"] = {
      report: { id: "r1", status: "OPEN", reason: "SPAM", details: "ad", createdAt: "2026-11-01T06:00:00Z", resolvedAt: null, decisionNote: null, decidedBy: null, reporter: { displayName: "Rina" }, target, otherReports: [] },
      history: [],
    };
    data["/admin/reports"] = { ...page, reports: [{ id: "r1", status: "OPEN", reason: "SPAM", details: "ad", createdAt: "2026-11-01T06:00:00Z", reportsOnThisItem: 1, target }] };
    api.mockResolvedValue({ report: { id: "r1", status: "ACTIONED" } });
    render(<ModerationView />);
    expect(screen.getByText("Open reports")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Rina")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolve…" }));
    const submit = screen.getByRole("button", { name: "Resolve report", hidden: true });
    expect(submit).toBeDisabled(); // note required
    fireEvent.change(screen.getByLabelText(/moderation note/i), { target: { value: "Advertising" } });
    fireEvent.click(screen.getByLabelText(/Hide it from everyone/));
    fireEvent.click(submit);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/reports/r1/decision", { method: "POST", body: { decision: "RESOLVE", note: "Advertising", contentAction: "HIDE" } }));
    // the confirmation lives at list level, so it survives the row leaving the filtered queue
    expect(await screen.findByText("Report resolved.")).toBeInTheDocument();
  });

  it("dismissing needs a reason and never sends a content action", async () => {
    data["/admin/moderation/overview"] = overview;
    data["/admin/reports/r1"] = {
      report: { id: "r1", status: "REVIEWING", reason: "SPAM", details: null, createdAt: "2026-11-01T06:00:00Z", resolvedAt: null, decisionNote: null, decidedBy: null, reporter: { displayName: "Rina" }, target, otherReports: [] },
      history: [],
    };
    data["/admin/reports"] = { ...page, reports: [{ id: "r1", status: "REVIEWING", reason: "SPAM", details: null, createdAt: "2026-11-01T06:00:00Z", reportsOnThisItem: 1, target }] };
    api.mockResolvedValue({ report: { id: "r1", status: "DISMISSED" } });
    render(<ModerationView />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss…" }));
    const confirm = screen.getByRole("button", { name: "Dismiss report", hidden: true });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Reason/, { selector: "textarea" }), { target: { value: "Not a violation" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/reports/r1/decision", { method: "POST", body: { decision: "DISMISS", note: "Not a violation" } }));
  });
});
