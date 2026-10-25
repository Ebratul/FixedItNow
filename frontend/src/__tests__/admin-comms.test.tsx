import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/announcements",
}));
let session: { user: { id: string } } | null = null;
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: session, isPending: false }) } }));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
const refresh = vi.fn();
const data: Record<string, unknown> = {};
const errors: Record<string, string> = {};
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: { isAdmin: true } }, reload: vi.fn() }),
  useApi: (path: string) => {
    const err = Object.keys(errors).find((k) => path.startsWith(k));
    if (err) return { state: { status: "error", message: errors[err] }, reload: vi.fn(), refresh, stale: false };
    const key = Object.keys(data).find((k) => path.startsWith(k));
    return { state: key ? { status: "ready", data: data[key] } : { status: "loading" }, reload: vi.fn(), refresh, stale: false };
  },
}));

import { ApiError } from "@/lib/api";
import { AdminProvider } from "@/components/admin/shell/admin-context";
import { AnnouncementsView } from "@/components/admin/comms/announcements-view";
import { validateAnnouncement, EMPTY_VALUES, toDhakaLocal } from "@/components/admin/comms/announcement-utils";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { SiteBanners } from "@/components/notifications/site-banners";
import { isInAppPath } from "@/components/notifications/types";
import type { Me } from "@/lib/use-api";

const me = (permissions: string[]): Me =>
  ({ user: { id: "a1", name: "Admin", email: "a@x.test", emailVerified: true, image: null }, isAdmin: true, admin: { role: { key: "ops", name: "Ops" }, permissions }, customer: { onboarded: true }, worker: { started: false, approved: false } }) as Me;
const asAdmin = (ui: React.ReactElement, permissions = ["notifications.manage", "users.read"]) => render(<AdminProvider me={me(permissions)}>{ui}</AdminProvider>);

const row = (over: object = {}) => ({
  id: "11111111-1111-4111-8111-111111111111", title: "Eid delivery delays", body: "Expect delays.", audience: "CUSTOMERS", severity: "WARNING", status: "DRAFT",
  startsAt: null, endsAt: null, publishedAt: null, createdAt: "2026-11-01T06:00:00Z", updatedAt: "2026-11-01T06:00:00Z", createdBy: "Rina", live: false, ...over,
});
const list = (rows: object[]) => ({ announcements: rows, page: 1, pageSize: 20, total: rows.length, totalPages: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  api.mockReset();
  session = null;
  for (const k of Object.keys(data)) delete data[k];
  for (const k of Object.keys(errors)) delete errors[k];
  localStorage.clear();
});

describe("isInAppPath", () => {
  it("accepts in-app paths only", () => {
    expect(isInAppPath("/account/support")).toBe(true);
    expect(isInAppPath("/bookings/abc?tab=1")).toBe(true);
    for (const bad of ["https://evil.test", "//evil.test", "javascript:alert(1)", "account", "", "/a b", "/\\evil", null, undefined]) expect(isInAppPath(bad)).toBe(false);
  });
});

describe("announcement validation", () => {
  it("checks title, body and that the end is after the start", () => {
    expect(validateAnnouncement(EMPTY_VALUES)).toMatchObject({ title: expect.any(String), body: expect.any(String) });
    const ok = { ...EMPTY_VALUES, title: "Hello there", body: "Body" };
    expect(validateAnnouncement(ok)).toEqual({});
    expect(validateAnnouncement({ ...ok, startsAt: "2026-11-05T10:00", endsAt: "2026-11-05T09:00" }).endsAt).toMatch(/after the start/);
    expect(validateAnnouncement({ ...ok, body: "x".repeat(2001) }).body).toBeDefined();
  });
  it("round-trips Bangladesh local time", () => {
    expect(toDhakaLocal("2026-11-05T04:00:00.000Z")).toBe("2026-11-05T10:00");
  });
});

describe("admin announcements", () => {
  it("lists real rows with a live indicator and the window", () => {
    data["/admin/announcements"] = list([
      row({ id: "a", title: "Live notice", status: "PUBLISHED", live: true, audience: "ALL", severity: "CRITICAL" }),
      row({ id: "b", title: "Scheduled notice", status: "PUBLISHED", live: false, startsAt: "2030-01-01T04:00:00Z" }),
      row({ id: "c", title: "Old notice", status: "ARCHIVED" }),
    ]);
    asAdmin(<AnnouncementsView />);
    expect(screen.getByRole("heading", { level: 1, name: "Announcements" })).toBeInTheDocument();
    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText(/Not live/)).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    // archived rows cannot be edited, published or archived again
    expect(screen.queryByRole("button", { name: "Edit Old notice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish Live notice" })).not.toBeInTheDocument();
  });

  it("shows empty and error states", () => {
    data["/admin/announcements"] = list([]);
    const { unmount } = asAdmin(<AnnouncementsView />);
    expect(screen.getByText("No announcements yet")).toBeInTheDocument();
    unmount();
    delete data["/admin/announcements"];
    errors["/admin/announcements"] = "Boom";
    asAdmin(<AnnouncementsView />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("hides the page content when the role lacks notifications.manage", () => {
    data["/admin/announcements"] = list([row()]);
    asAdmin(<AnnouncementsView />, ["dashboard.view"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(screen.queryByText("Eid delivery delays")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New announcement/ })).not.toBeInTheDocument();
  });

  it("publishes only after a confirmation that names the audience, and sends confirm: true", async () => {
    data["/admin/announcements"] = list([row()]);
    api.mockResolvedValueOnce({});
    asAdmin(<AnnouncementsView />);
    fireEvent.click(screen.getByRole("button", { name: "Publish Eid delivery delays" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/signed-in customers/)).toBeInTheDocument();
    expect(within(dialog).getByText(/immediately/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/announcements/11111111-1111-4111-8111-111111111111/publish", { method: "POST", body: { confirm: true } }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText(/is published/)).toBeInTheDocument();
  });

  it("keeps the publish dialog open and shows the server message on failure", async () => {
    data["/admin/announcements"] = list([row()]);
    api.mockRejectedValueOnce(new ApiError(422, "The end time has passed; edit it first", {}, "ALREADY_EXPIRED"));
    asAdmin(<AnnouncementsView />);
    fireEvent.click(screen.getByRole("button", { name: "Publish Eid delivery delays" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish now" }));
    expect(await screen.findByText("The end time has passed; edit it first")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("archives behind a confirmation", async () => {
    data["/admin/announcements"] = list([row({ status: "PUBLISHED", live: true })]);
    api.mockResolvedValueOnce({});
    asAdmin(<AnnouncementsView />);
    fireEvent.click(screen.getByRole("button", { name: "Archive Eid delivery delays" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/announcements/11111111-1111-4111-8111-111111111111/archive", { method: "POST", body: {} }));
  });

  it("validates the form (end after start) before calling the API, then creates with Dhaka times as UTC", async () => {
    data["/admin/announcements"] = list([]);
    api.mockResolvedValueOnce({});
    asAdmin(<AnnouncementsView />);
    fireEvent.click(screen.getByRole("button", { name: /New announcement/ }));
    const form = screen.getByRole("form", { name: "New announcement" });
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Maintenance tonight" } });
    fireEvent.change(within(form).getByLabelText("Message"), { target: { value: "Short downtime." } });
    expect(within(form).getByText("15 / 2000 characters. Plain text only.")).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText(/Show from/), { target: { value: "2026-11-05T10:00" } });
    fireEvent.change(within(form).getByLabelText(/Show until/), { target: { value: "2026-11-05T09:00" } });
    fireEvent.click(within(form).getByRole("button", { name: "Create draft" }));
    expect(await within(form).findByText("The end must be after the start.")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText(/Show until/), { target: { value: "2026-11-05T12:00" } });
    fireEvent.click(within(form).getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledWith("/admin/announcements", {
      method: "POST",
      body: { title: "Maintenance tonight", body: "Short downtime.", audience: "ALL", severity: "INFO", startsAt: "2026-11-05T04:00:00.000Z", endsAt: "2026-11-05T06:00:00.000Z" },
    });
  });

  describe("send to one user", () => {
    it("searches users, picks one and sends after confirming", async () => {
      data["/admin/announcements"] = list([]);
      api.mockImplementation((path: string) => {
        if (path.startsWith("/admin/users")) return Promise.resolve({ users: [{ id: "user-id-12345", name: "Karim Uddin", email: "karim@x.test" }] });
        return Promise.resolve({ notification: { id: "n1" } });
      });
      asAdmin(<AnnouncementsView />);
      fireEvent.change(screen.getByLabelText("Find the user"), { target: { value: "karim" } });
      fireEvent.click(await screen.findByRole("button", { name: /Karim Uddin/ }, { timeout: 2000 }));
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "About your ticket" } });
      fireEvent.change(screen.getByLabelText("Message"), { target: { value: "We replied." } });
      fireEvent.change(screen.getByLabelText("Link (optional)"), { target: { value: "https://evil.test" } });
      fireEvent.click(screen.getByRole("button", { name: "Review and send" }));
      expect(await screen.findByText(/must start with a single/)).toBeInTheDocument();
      expect(api).not.toHaveBeenCalledWith("/admin/notifications", expect.anything());
      fireEvent.change(screen.getByLabelText("Link (optional)"), { target: { value: "/account/support" } });
      fireEvent.click(screen.getByRole("button", { name: "Review and send" }));
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send notification" }));
      await waitFor(() =>
        expect(api).toHaveBeenCalledWith("/admin/notifications", { method: "POST", body: { userId: "user-id-12345", title: "About your ticket", body: "We replied.", link: "/account/support" } }),
      );
      expect(await screen.findByText(/Notification sent to Karim Uddin/)).toBeInTheDocument();
    });

    it("falls back to a user id input when the search answers 403", async () => {
      data["/admin/announcements"] = list([]);
      api.mockRejectedValue(new ApiError(403, "You don't have permission to do that."));
      asAdmin(<AnnouncementsView />);
      fireEvent.change(screen.getByLabelText("Find the user"), { target: { value: "karim" } });
      expect(await screen.findByLabelText("User id", {}, { timeout: 2000 })).toBeInTheDocument();
    });

    it("starts with the user id input when the role cannot read users", () => {
      data["/admin/announcements"] = list([]);
      asAdmin(<AnnouncementsView />, ["notifications.manage"]);
      expect(screen.getByLabelText("User id")).toBeInTheDocument();
      expect(screen.queryByLabelText("Find the user")).not.toBeInTheDocument();
    });
  });
});

describe("notification bell", () => {
  it("shows the unread count with an accessible label and links to the list", async () => {
    api.mockResolvedValue({ unreadCount: 3 });
    render(<NotificationBell />);
    const link = await screen.findByRole("link", { name: "Notifications, 3 unread" });
    expect(link).toHaveAttribute("href", "/account/notifications");
    expect(api).toHaveBeenCalledWith("/notifications/unread-count");
  });

  it("handles errors silently and polls every minute", async () => {
    vi.useFakeTimers();
    try {
      api.mockRejectedValue(new Error("down"));
      render(<NotificationBell />);
      await act(async () => {});
      expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
      api.mockResolvedValue({ unreadCount: 2 });
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(screen.getByRole("link", { name: "Notifications, 2 unread" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops polling when unmounted", async () => {
    vi.useFakeTimers();
    try {
      api.mockResolvedValue({ unreadCount: 1 });
      const { unmount } = render(<NotificationBell />);
      await act(async () => {});
      unmount();
      api.mockClear();
      await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
      expect(api).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("notifications page", () => {
  const n = (over: object = {}) => ({ id: "n1", type: "admin.message", title: "Ticket update", body: "We replied.", link: "/account/support", readAt: null, createdAt: "2026-11-01T06:00:00Z", ...over });
  const page = (items: object[], unreadCount: number) => ({ notifications: items, unreadCount, page: 1, pageSize: 20, total: items.length, totalPages: 1 });

  it("highlights unread items, opens in-app links only, and marks read", async () => {
    data["/me"] = { isAdmin: false };
    data["/notifications"] = page([n(), n({ id: "n2", title: "Hostile", link: "https://evil.test", readAt: null }), n({ id: "n3", title: "Old one", readAt: "2026-11-01T07:00:00Z" })], 2);
    api.mockResolvedValue({ unreadCount: 1 });
    render(<NotificationsList />);
    expect(screen.getAllByText("Unread")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Open" })).toHaveLength(2); // n1 and n3; the https link is not rendered
    fireEvent.click(screen.getByRole("button", { name: "Mark as read: Hostile" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/notifications/n2/read", { method: "POST" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("marks all read and shows empty and error states", async () => {
    data["/me"] = { isAdmin: false };
    data["/notifications"] = page([n()], 1);
    api.mockResolvedValue({ unreadCount: 0 });
    const { unmount } = render(<NotificationsList />);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/notifications/read-all", { method: "POST" }));
    unmount();
    data["/notifications"] = page([], 0);
    const second = render(<NotificationsList />);
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    second.unmount();
    delete data["/notifications"];
    errors["/notifications"] = "Could not load";
    render(<NotificationsList />);
    expect(screen.getByText("Could not load")).toBeInTheDocument();
  });
});

describe("site banners", () => {
  const ann = (id: string, severity: string, title = `Notice ${id}`) => ({ id, title, body: `Body ${id}`, severity, publishedAt: "2026-11-01T06:00:00Z", endsAt: null });
  function serve(opts: { platform?: unknown; announcements?: unknown; fail?: boolean } = {}) {
    api.mockImplementation((path: string) => {
      if (opts.fail) return Promise.reject(new Error("down"));
      if (path === "/config/platform") return Promise.resolve(opts.platform ?? { maintenanceMode: false, maintenanceMessage: "" });
      return Promise.resolve({ announcements: opts.announcements ?? [] });
    });
  }

  it("shows the maintenance message as a status", async () => {
    serve({ platform: { maintenanceMode: true, maintenanceMessage: "Back at 6pm." } });
    render(<SiteBanners />);
    expect(await screen.findByText("Back at 6pm.")).toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("uses the public endpoint when signed out and the personal one when signed in", async () => {
    serve({ announcements: [ann("a", "INFO")] });
    const { unmount } = render(<SiteBanners />);
    expect(await screen.findByText("Notice a")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/announcements");
    unmount();
    api.mockClear();
    session = { user: { id: "u1" } };
    serve({ announcements: [ann("b", "WARNING")] });
    render(<SiteBanners />);
    expect(await screen.findByText("Notice b")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/me/announcements");
  });

  it("dismisses per browser, remembers it, and never offers dismiss on critical", async () => {
    serve({ announcements: [ann("a", "INFO"), ann("c", "CRITICAL")] });
    const { unmount } = render(<SiteBanners />);
    await screen.findByText("Notice a");
    expect(screen.queryByRole("button", { name: "Dismiss: Notice c" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Notice a" }));
    expect(screen.queryByText("Notice a")).not.toBeInTheDocument();
    expect(localStorage.getItem("fin.dismissed.a")).toBe("1");
    unmount();
    render(<SiteBanners />);
    await screen.findByText("Notice c");
    expect(screen.queryByText("Notice a")).not.toBeInTheDocument();
  });

  it("shows at most three, critical first", async () => {
    serve({ announcements: [ann("1", "INFO"), ann("2", "INFO"), ann("3", "WARNING"), ann("4", "CRITICAL")] });
    render(<SiteBanners />);
    await screen.findByText("Notice 4");
    expect(screen.getAllByText(/^Notice /)).toHaveLength(3);
    expect(screen.queryByText("Notice 2")).not.toBeInTheDocument();
  });

  it("still works when storage throws", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      serve({ announcements: [ann("a", "INFO")] });
      render(<SiteBanners />);
      await screen.findByText("Notice a");
      fireEvent.click(screen.getByRole("button", { name: "Dismiss: Notice a" }));
      expect(screen.queryByText("Notice a")).not.toBeInTheDocument();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it("renders nothing when the requests fail", async () => {
    serve({ fail: true });
    const { container } = render(<SiteBanners />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});

describe("account entry points", () => {
  it("user menu shows bell, Notifications, Support and the admin panel for admins", async () => {
    session = { user: { id: "u1", name: "Admin", email: "a@x.test" } } as never;
    api.mockResolvedValue({ unreadCount: 4 });
    const { UserMenu } = await import("@/components/layout/user-menu");
    render(<UserMenu />);
    expect(await screen.findByRole("link", { name: "Notifications, 4 unread" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Admin/ }));
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/account/support");
    expect(screen.getByRole("link", { name: "Notifications" })).toHaveAttribute("href", "/account/notifications");
    expect(screen.getByRole("link", { name: "Admin panel" })).toHaveAttribute("href", "/admin");
  });
});
