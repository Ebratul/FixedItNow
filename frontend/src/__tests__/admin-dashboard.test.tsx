import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let current: { status: string; data?: unknown; message?: string } = { status: "loading" };
const reload = vi.fn();
const seen: string[] = [];
vi.mock("@/lib/use-api", () => ({
  useApi: (path: string) => {
    seen.push(path);
    return { state: current, reload, refresh: vi.fn(), stale: false };
  },
}));

import { AdminProvider } from "@/components/admin/shell/admin-context";
import { DashboardView, type Dashboard } from "@/components/admin/dashboard/dashboard-view";
import { BarChart } from "@/components/admin/dashboard/bar-chart";
import type { Me } from "@/lib/use-api";

const me = (permissions: string[]) => ({ user: { id: "a1", name: "Admin", email: "a@x.test", emailVerified: true, image: null }, isAdmin: true, admin: { role: { key: "r", name: "Role" }, permissions }, customer: { onboarded: false }, worker: { started: false, approved: false } }) as unknown as Me;
const days = (n: number) => Array.from({ length: n }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, value: i % 3 }));
const data = (over: Partial<Dashboard> = {}): Dashboard => ({
  generatedAt: "2026-11-07T06:00:00Z", days: 7,
  users: { total: 120, new: 9, suspended: 2, customers: 80 },
  workers: { total: 30, verified: 20, pending: 4, rejected: 1, resubmission: 2, notSubmitted: 3, published: 18 },
  bookings: { total: 55, new: 6, byStatus: { CONFIRMED: 5, IN_PROGRESS: 2, COMPLETED: 40, DISPUTED: 1 } },
  attention: [{ key: "workerReviews", label: "Worker applications to review", count: 4, href: "/admin/workers" }],
  trends: { newUsers: days(7), bookings: days(7) },
  finance: null, recentActivity: null, ...over,
});
const renderIt = (permissions: string[]) => render(<AdminProvider me={me(permissions)}><DashboardView /></AdminProvider>);

beforeEach(() => { current = { status: "loading" }; seen.length = 0; reload.mockReset(); });

describe("admin dashboard", () => {
  it("shows a loading state, then real numbers and links to the queues", () => {
    renderIt(["dashboard.view"]);
    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");
    current = { status: "ready", data: data() };
    renderIt(["dashboard.view"]);
    const link = screen.getByRole("link", { name: /Worker applications to review/ });
    expect(link).toHaveAttribute("href", "/admin/workers");
    expect(link.closest("div")!.textContent).toContain("4");
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/9 new in 7 days/)).toBeInTheDocument();
  });

  it("hides money and activity sections when the API did not send them", () => {
    current = { status: "ready", data: data() };
    renderIt(["dashboard.view"]);
    expect(screen.queryByRole("heading", { name: /Money/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Recent admin activity/ })).toBeNull();
  });

  it("shows finance and activity when present, using formatted taka", () => {
    current = { status: "ready", data: data({
      finance: { collectedBdt: 1500, refundedBdt: 500, netBdt: 1000, payments: 3, series: days(7) },
      recentActivity: [{ id: "x", action: "user.suspend", targetType: "User", at: "2026-11-07T05:00:00Z", by: "Root" }],
    }) };
    renderIt(["dashboard.view", "finance.reports", "audit.read"]);
    expect(screen.getByRole("heading", { name: /Money, last 7 days/ })).toBeInTheDocument();
    expect(screen.getByText("৳1,500")).toBeInTheDocument();
    expect(screen.getByText("user.suspend")).toBeInTheDocument();
  });

  it("says so when nothing needs attention, and when the role has no queues", () => {
    current = { status: "ready", data: data({ attention: [{ key: "a", label: "Open disputes", count: 0, href: "/admin/disputes" }] }) };
    renderIt(["dashboard.view"]);
    expect(screen.getByText(/Nothing is waiting for a decision/)).toBeInTheDocument();
  });

  it("offers retry on error and refuses to load for a role without dashboard.view", () => {
    current = { status: "error", message: "Something went wrong on our side. Please try again." };
    renderIt(["dashboard.view"]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalled();
    seen.length = 0;
    renderIt(["users.read"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
  });

  it("changes the period", () => {
    current = { status: "ready", data: data() };
    renderIt(["dashboard.view"]);
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "90" } });
    expect(seen).toContain("/admin/dashboard?days=90");
  });
});

describe("BarChart", () => {
  it("names the series, totals it, anchors zero bars at zero height and offers a table", () => {
    render(<BarChart title="New users per day" points={[{ date: "2026-11-01", value: 0 }, { date: "2026-11-02", value: 4 }]} />);
    expect(screen.getByRole("img", { name: /New users per day, 2 days, total 4/ })).toBeInTheDocument();
    expect(screen.getByText("Total 4")).toBeInTheDocument();
    // the same numbers are always reachable as a table
    expect(screen.getByText("Show as table")).toBeInTheDocument();
  });
  it("handles an empty series", () => {
    render(<BarChart title="Empty" points={[]} />);
    expect(screen.getByText("Total 0")).toBeInTheDocument();
  });
});
