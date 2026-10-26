import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/account" }));

let session: { user: { id: string } } | null = null;
const signOut = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session, isPending: false }),
    signOut: (...a: unknown[]) => signOut(...a),
    listAccounts: vi.fn().mockResolvedValue({ data: [{ providerId: "credential" }], error: null }),
    revokeOtherSessions: vi.fn(),
    linkSocial: vi.fn(),
  },
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
let me: unknown;
const listPaths: string[] = [];
vi.mock("@/lib/use-api", () => ({
  useApi: (path: string) => {
    listPaths.push(path);
    return { state: { status: "ready", data: { bookings: [], total: 0, page: 1, pageSize: 10, totalPages: 0 } }, reload: vi.fn(), refresh: vi.fn(), stale: false };
  },
  useMe: () => ({ state: { status: "ready", data: me }, reload: vi.fn() }),
  useAuthConfig: () => ({ state: { status: "ready", data: { googleEnabled: true } }, reload: vi.fn() }),
}));

import { AccountOverview } from "@/components/account/account-overview";
import { BookingListView } from "@/components/bookings/booking-list";
import { DemoBanner } from "@/components/layout/demo-banner";
import type { Me } from "@/lib/use-api";

const baseMe = (over: Partial<Me> = {}): Me => ({
  user: { id: "u1", name: "Demo Customer", email: "demo.customer@example.test", emailVerified: true, image: null },
  isAdmin: false,
  admin: null,
  customer: { onboarded: true },
  worker: { started: false, approved: false },
  demo: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  session = null;
  me = baseMe();
});

describe("DemoBanner", () => {
  it("shows the bar and an exit button for a demo session, from GET /me", async () => {
    session = { user: { id: "u1" } };
    api.mockResolvedValue(baseMe({ demo: { role: "customer" } }));
    render(<DemoBanner />);
    const region = await screen.findByRole("region", { name: "Demo mode" });
    expect(region).toHaveTextContent("Demo mode — you're exploring as Demo Customer with fictional data. Nothing here is real.");
    expect(screen.getByRole("button", { name: "Exit demo" })).toBeEnabled();
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/me");
  });

  it.each([["worker", "Demo Worker"], ["admin", "Demo Admin"]] as const)("names the %s role", async (role, label) => {
    session = { user: { id: "u1" } };
    api.mockResolvedValue(baseMe({ demo: { role } }));
    render(<DemoBanner />);
    expect(await screen.findByText(new RegExp(`exploring as ${label}`))).toBeInTheDocument();
  });

  it("renders nothing for an ordinary user", async () => {
    session = { user: { id: "u1" } };
    api.mockResolvedValue(baseMe({ demo: null }));
    const { container } = render(<DemoBanner />);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/me"));
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing, and asks the server nothing, when signed out", async () => {
    const { container } = render(<DemoBanner />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(api).not.toHaveBeenCalled();
  });

  it("renders nothing while loading or when /me fails, and ignores an unknown role", async () => {
    session = { user: { id: "u1" } };
    api.mockReturnValueOnce(new Promise(() => {}));
    const loading = render(<DemoBanner />);
    expect(loading.container).toBeEmptyDOMElement();
    loading.unmount();

    api.mockRejectedValueOnce(new Error("down"));
    const failed = render(<DemoBanner />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(failed.container).toBeEmptyDOMElement();
    failed.unmount();

    api.mockResolvedValueOnce(baseMe({ demo: { role: "root" as never } }));
    const unknown = render(<DemoBanner />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
    await act(async () => {});
    expect(unknown.container).toBeEmptyDOMElement();
  });

  it("signs out, then goes to /login and refreshes, with a loading state and a single request", async () => {
    session = { user: { id: "u1" } };
    api.mockResolvedValue(baseMe({ demo: { role: "customer" } }));
    let finish: (v: unknown) => void = () => {};
    signOut.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<DemoBanner />);
    const exit = await screen.findByRole("button", { name: "Exit demo" });
    fireEvent.click(exit);
    fireEvent.click(exit);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled(); // not before the server confirms
    await waitFor(() => expect(screen.getByRole("button", { name: /Exiting/ })).toBeDisabled());
    await act(async () => finish({ data: { success: true }, error: null }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("stays and says so when signing out fails", async () => {
    session = { user: { id: "u1" } };
    api.mockResolvedValue(baseMe({ demo: { role: "customer" } }));
    signOut.mockResolvedValue({ data: null, error: { status: 500 } });
    render(<DemoBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "Exit demo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't exit the demo/);
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Exit demo" })).toBeEnabled());
  });
});

describe("account page for demo sessions", () => {
  it("hides sign-in methods and 'Log out other devices' and explains why", () => {
    me = baseMe({ demo: { role: "customer" } });
    render(<AccountOverview />);
    expect(screen.queryByRole("heading", { name: "Sign-in methods" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out other devices" })).not.toBeInTheDocument();
    expect(screen.getByText(/This is a shared demo account — sign-in settings are disabled\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("is unchanged for an ordinary account", async () => {
    render(<AccountOverview />);
    expect(await screen.findByRole("heading", { name: "Sign-in methods" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out other devices" })).toBeInTheDocument();
    expect(screen.queryByText(/shared demo account/)).not.toBeInTheDocument();
  });
});

describe("bookings list ?role=worker", () => {
  beforeEach(() => {
    listPaths.length = 0;
  });

  it("opens the professional's side first for a worker", () => {
    me = baseMe({ worker: { started: true, approved: true }, demo: { role: "worker" } });
    render(<BookingListView initialRole="worker" />);
    expect(screen.getByRole("button", { name: "Jobs for me" })).toHaveAttribute("aria-pressed", "true");
    expect(listPaths.at(-1)).toContain("role=worker");
  });

  it("defaults to the customer's side, and ignores worker for someone who is not a worker", () => {
    me = baseMe({ worker: { started: true, approved: true } });
    const first = render(<BookingListView />);
    expect(screen.getByRole("button", { name: "My requests" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();
    listPaths.length = 0;
    me = baseMe();
    render(<BookingListView initialRole="worker" />);
    expect(screen.queryByRole("group", { name: "View as" })).not.toBeInTheDocument();
    expect(listPaths.at(-1)).toContain("role=customer");
  });
});

describe("downloadFile for the demo administrator", () => {
  it("shows the demo refusal text for a DEMO_ 403 and the plain permission text otherwise", async () => {
    const { downloadFile } = await import("@/components/admin/kit/query");
    const respond = (status: number, body: unknown) =>
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => body }));
    respond(403, { code: "DEMO_RESTRICTED", message: "Exports are turned off in the demo." });
    await expect(downloadFile("/admin/x", "x.csv")).rejects.toThrow("Exports are turned off in the demo.");
    respond(403, { code: "PERMISSION_DENIED", message: "nope" });
    await expect(downloadFile("/admin/x", "x.csv")).rejects.toThrow("You don't have permission to export this.");
    respond(403, null);
    await expect(downloadFile("/admin/x", "x.csv")).rejects.toThrow("You don't have permission to export this.");
    vi.unstubAllGlobals();
  });
});
