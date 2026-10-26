import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const notify = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    $store: { notify: (...a: unknown[]) => notify(...a) },
    signIn: { email: vi.fn(), social: vi.fn() },
    useSession: () => ({ data: null, isPending: false }),
  },
}));
vi.mock("@/lib/use-api", () => ({
  useAuthConfig: () => ({ state: { status: "ready", data: { googleEnabled: false } }, reload: vi.fn() }),
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));

import LoginPage from "@/app/login/page";
import DemoRolePage from "@/app/demo/[role]/page";
import { DemoLoginSection } from "@/components/auth/demo-login-section";
import { DemoRoleView } from "@/components/auth/demo-role-view";
import { ApiError } from "@/lib/api";
import { demoErrorMessage, DEMO_DEFAULT_REDIRECT, fetchDemoOptions, isDemoKey, startDemoSession } from "@/lib/demo";

const OPTIONS = [
  { role: "customer", label: "Demo Customer", description: "Book a service with fictional professionals.", available: true },
  { role: "worker", label: "Demo Worker", description: "See the jobs a professional receives.", available: true },
  { role: "admin", label: "Demo Admin", description: "Read-only admin panel.", available: true },
];

type Handler = (body: unknown) => unknown;
/** Routes `api()` calls: GET /demo/options returns `options`; POST /auth/demo/sign-in is handled by `signIn`. */
function serve(options: unknown, signIn: Handler = (body) => ({ role: (body as { role: string }).role, redirectTo: "/account" })) {
  api.mockImplementation(async (path: string, init?: { body?: unknown }) => {
    if (path === "/demo/options") {
      if (options instanceof Error) throw options;
      return { options };
    }
    if (path === "/auth/demo/sign-in") return signIn(init?.body);
    throw new Error(`unexpected ${path}`);
  });
}
const signInCalls = () => api.mock.calls.filter((c) => c[0] === "/auth/demo/sign-in");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("demo helpers", () => {
  it("knows the three roles and nothing else", () => {
    expect(["customer", "worker", "admin"].every(isDemoKey)).toBe(true);
    for (const bad of ["super_admin", "", "Customer", null, undefined, 1]) expect(isDemoKey(bad)).toBe(false);
  });

  it("maps every refusal to a clear message", () => {
    expect(demoErrorMessage(new ApiError(403, "x", {}, "DEMO_DISABLED"), "Demo Admin")).toBe("Demo Admin is not available right now.");
    expect(demoErrorMessage(new ApiError(409, "x", {}, "ALREADY_SIGNED_IN"), "Demo Admin")).toMatch(/already signed in\. Log out first/);
    expect(demoErrorMessage(new ApiError(429, "x"), "Demo Admin")).toMatch(/Too many attempts/);
    expect(demoErrorMessage(new ApiError(503, "x", {}, "DEMO_BUSY"), "Demo Admin")).toMatch(/busy/);
    expect(demoErrorMessage(new ApiError(503, "x", {}, "DEMO_UNAVAILABLE"), "Demo Admin")).toMatch(/not set up/);
    expect(demoErrorMessage(new ApiError(0, "We couldn't reach the server. Check your connection and try again."), "Demo Admin")).toMatch(/couldn't reach the server/);
    expect(demoErrorMessage(new ApiError(400, "x"), "Demo Admin")).toBe("We couldn't start the demo. Please try again.");
    expect(demoErrorMessage(new Error("boom"), "Demo Admin")).toBe("We couldn't start the demo. Please try again.");
  });

  it("sends only the role, refreshes the session store, and only returns a same-site redirect", async () => {
    api.mockResolvedValueOnce({ role: "worker", redirectTo: "/bookings?role=worker" });
    await expect(startDemoSession("worker")).resolves.toEqual({ role: "worker", redirectTo: "/bookings?role=worker" });
    expect(api).toHaveBeenCalledWith("/auth/demo/sign-in", { method: "POST", body: { role: "worker" } });
    expect(notify).toHaveBeenCalledWith("$sessionSignal");

    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", undefined, 7]) {
      api.mockResolvedValueOnce({ role: "admin", redirectTo: bad });
      expect((await startDemoSession("admin")).redirectTo).toBe(DEMO_DEFAULT_REDIRECT.admin);
    }
  });

  it("keeps only well-formed, unique options", async () => {
    api.mockResolvedValueOnce({
      options: [
        { role: "customer", label: "Demo Customer", description: "d", available: true },
        { role: "customer", label: "Duplicate", description: "d", available: true },
        { role: "root", label: "Nope", description: "d", available: true },
        { role: "worker", available: "yes" },
        null,
      ],
    });
    expect(await fetchDemoOptions()).toEqual([
      { role: "customer", label: "Demo Customer", description: "d", available: true },
      { role: "worker", label: "Demo Worker", description: "", available: false },
    ]);
  });
});

describe("DemoLoginSection", () => {
  it("lists every visible option with its description and a Continue button", async () => {
    serve(OPTIONS);
    render(<DemoLoginSection />);
    expect(await screen.findByRole("heading", { level: 2, name: "Explore Demo" })).toBeInTheDocument();
    expect(screen.getByText(/No account or password needed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Demo Customer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue as Demo Worker" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue as Demo Admin" })).toBeEnabled();
    expect(screen.getByText("Book a service with fictional professionals.")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/demo/options");
  });

  it("does not render an option the server did not list (hidden)", async () => {
    serve(OPTIONS.filter((o) => o.role !== "admin"));
    render(<DemoLoginSection />);
    await screen.findByRole("button", { name: "Continue as Demo Customer" });
    expect(screen.queryByText("Demo Admin")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Demo Admin/ })).not.toBeInTheDocument();
  });

  it("renders nothing at all (no heading) when the list is empty or cannot be loaded", async () => {
    serve([]);
    const first = render(<DemoLoginSection />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByText("Explore Demo")).not.toBeInTheDocument();
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();

    serve(new ApiError(0, "We couldn't reach the server."));
    const second = render(<DemoLoginSection />);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(second.container).toBeEmptyDOMElement();
  });

  it("shows nothing while the options are loading", () => {
    api.mockReturnValue(new Promise(() => {}));
    const { container } = render(<DemoLoginSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an unavailable option as disabled with a badge, and a click does nothing", async () => {
    serve(OPTIONS.map((o) => (o.role === "admin" ? { ...o, available: false } : o)));
    render(<DemoLoginSection />);
    const button = await screen.findByRole("button", { name: "Continue as Demo Admin" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/switched off right now/)).toBeInTheDocument();
    fireEvent.click(button);
    expect(signInCalls()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Continue as Demo Customer" })).toBeEnabled();
  });

  it("posts exactly {role}, then replaces to the server's redirect and refreshes", async () => {
    serve(OPTIONS, () => ({ role: "worker", redirectTo: "/bookings?role=worker" }));
    render(<DemoLoginSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Demo Worker" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bookings?role=worker"));
    expect(router.refresh).toHaveBeenCalled();
    expect(signInCalls()).toEqual([["/auth/demo/sign-in", { method: "POST", body: { role: "worker" } }]]);
    // Still locked while the browser navigates.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it("falls back to the role's own landing page when the redirect is not a same-site path", async () => {
    serve(OPTIONS, () => ({ role: "admin", redirectTo: "https://evil.example/steal" }));
    render(<DemoLoginSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Demo Admin" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin"));
  });

  it("disables every demo button while a request is in flight and a double click sends one request", async () => {
    let finish: (value: unknown) => void = () => {};
    serve(OPTIONS, () => new Promise((resolve) => { finish = resolve; }));
    render(<DemoLoginSection />);
    const button = await screen.findByRole("button", { name: "Continue as Demo Customer" });
    fireEvent.click(button);
    fireEvent.click(button); // same tick: the ref guard, not just the disabled state, stops the second request
    expect(signInCalls()).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole("button", { name: /Starting/ })).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Continue as Demo Worker" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue as Demo Admin" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Starting the demo");
    await act(async () => finish({ role: "customer", redirectTo: "/account" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
    expect(signInCalls()).toHaveLength(1);
  });

  it.each([
    [new ApiError(403, "The server text", {}, "DEMO_DISABLED"), /Demo Customer is not available right now\./],
    [new ApiError(409, "x", {}, "ALREADY_SIGNED_IN"), /already signed in\. Log out first/],
    [new ApiError(429, "Too many requests."), /Too many attempts/],
    [new ApiError(503, "x", {}, "DEMO_BUSY"), /busy right now/],
    [new ApiError(503, "x", {}, "DEMO_UNAVAILABLE"), /not set up on this server/],
    [new ApiError(0, "We couldn't reach the server. Check your connection and try again."), /couldn't reach the server/],
  ])("shows %# as an alert, does not navigate, and re-enables the buttons", async (error, message) => {
    serve(OPTIONS, () => { throw error; });
    render(<DemoLoginSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Demo Customer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue as Demo Customer" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Continue as Demo Admin" })).toBeEnabled();
  });

  it("allows a retry after an error and clears the old error", async () => {
    let calls = 0;
    serve(OPTIONS, () => {
      if (++calls === 1) throw new ApiError(503, "x", {}, "DEMO_BUSY");
      return { role: "customer", redirectTo: "/account" };
    });
    render(<DemoLoginSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Demo Customer" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Continue as Demo Customer" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(signInCalls()).toHaveLength(2);
  });

  it("never stores anything in browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    serve(OPTIONS);
    render(<DemoLoginSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Demo Customer" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe("login page", () => {
  it("keeps the log-in form and adds the demo section below it", async () => {
    serve(OPTIONS);
    render(<LoginPage />);
    const form = screen.getByRole("button", { name: "Log in" });
    const demo = await screen.findByRole("heading", { name: "Explore Demo" });
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeInTheDocument();
    expect(form.compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("looks exactly as before when no demo option is visible", async () => {
    serve([]);
    render(<LoginPage />);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/demo/options"));
    await act(async () => {});
    expect(screen.queryByText("Explore Demo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });
});

describe("/demo/[role]", () => {
  it("does not sign in on load: only a button press posts", async () => {
    serve(OPTIONS);
    render(<DemoRoleView role="worker" />);
    expect(await screen.findByRole("button", { name: "Continue as Demo Worker" })).toBeEnabled();
    expect(screen.getByText("See the jobs a professional receives.")).toBeInTheDocument();
    expect(screen.queryByText("Demo Customer")).not.toBeInTheDocument(); // a single role
    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
    expect(signInCalls()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Continue as Demo Worker" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
    expect(signInCalls()).toEqual([["/auth/demo/sign-in", { method: "POST", body: { role: "worker" } }]]);
  });

  it("shows a loading state first", () => {
    api.mockReturnValue(new Promise(() => {}));
    render(<DemoRoleView role="customer" />);
    expect(screen.getByLabelText("Loading the demo")).toHaveAttribute("aria-busy", "true");
  });

  it("explains a visible but switched-off option and offers the log-in page instead", async () => {
    serve(OPTIONS.map((o) => (o.role === "customer" ? { ...o, available: false } : o)));
    render(<DemoRoleView role="customer" />);
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Demo Customer" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
  });

  it("offers a hidden role (not listed) by its direct link and lets the server decide", async () => {
    serve(OPTIONS.filter((o) => o.role !== "admin"), () => { throw new ApiError(403, "Demo Admin is not available right now.", {}, "DEMO_DISABLED"); });
    render(<DemoRoleView role="admin" />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue as Demo Admin" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demo Admin is not available right now.");
    expect(screen.getByRole("link", { name: "Back to log in" })).toBeInTheDocument();
  });

  it("says so when the options cannot be loaded", async () => {
    serve(new ApiError(500, "x"));
    render(<DemoRoleView role="customer" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load the demo options/);
    expect(screen.queryByRole("button", { name: /Continue as/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
  });

  it("the route renders 404 for an unknown role and the single-role view for a known one", async () => {
    const root = (role: string) => DemoRolePage({ params: Promise.resolve({ role }) }) as { props: { children: { type: (p: unknown) => Promise<unknown>; props: unknown } } };
    const inner = (role: string) => { const { children } = root(role).props; return children.type(children.props); };
    await expect(inner("super_admin")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(inner("..%2Fadmin")).rejects.toThrow("NEXT_NOT_FOUND");
    for (const role of ["customer", "worker", "admin"]) await expect(inner(role)).resolves.toBeTruthy();
  });
});
