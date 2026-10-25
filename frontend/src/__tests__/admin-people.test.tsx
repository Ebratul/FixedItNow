import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/admin/users" }));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
const data: Record<string, unknown> = {};
const requested: string[] = [];
vi.mock("@/lib/use-api", () => ({
  useApi: (path: string) => {
    requested.push(path);
    const key = data[path] !== undefined ? path : Object.keys(data).filter((k) => path.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    const value = key ? data[key] : undefined;
    if (value instanceof Error) return { state: { status: "error", message: value.message }, reload: vi.fn(), refresh: vi.fn(), stale: false };
    return { state: value === undefined ? { status: "loading" } : { status: "ready", data: value }, reload: vi.fn(), refresh: vi.fn(), stale: false };
  },
}));
const downloadFile = vi.fn();
const lastAudit = () => requested.filter((p) => p.startsWith("/admin/audit?")).at(-1)!;
vi.mock("@/components/admin/kit/query", async (orig) => ({ ...(await orig<typeof import("@/components/admin/kit/query")>()), downloadFile: (...a: unknown[]) => downloadFile(...a) }));

import { AdminProvider } from "@/components/admin/shell/admin-context";
import { AuditView } from "@/components/admin/people/audit-view";
import { RoleEditor, validateRole } from "@/components/admin/people/role-editor";
import { RolesView } from "@/components/admin/people/roles-view";
import { SettingsView } from "@/components/admin/people/settings-view";
import { UserDetailView } from "@/components/admin/people/user-detail";
import { UsersList } from "@/components/admin/people/users-list";
import { ApiError } from "@/lib/api";
import type { Me } from "@/lib/use-api";

const ALL = ["users.read", "users.suspend", "roles.read", "roles.manage", "admins.assign", "audit.read", "audit.verify", "settings.read", "settings.manage"];
const meWith = (permissions: string[], id = "admin-self-1"): Me => ({
  user: { id, name: "Admin", email: "admin@example.com", emailVerified: true, image: null },
  isAdmin: true,
  admin: { role: { key: "ops", name: "Operations" }, permissions },
  customer: { onboarded: false },
  worker: { started: false, approved: false },
});
const renderAs = (permissions: string[], ui: ReactNode) => render(<AdminProvider me={meWith(permissions)}>{ui}</AdminProvider>);

const user = (over: object = {}) => ({
  id: "user-abc-123", name: "Rahim Uddin", email: "rahim@example.com", emailVerified: true, role: "USER", adminRole: null, suspended: false,
  createdAt: "2026-09-01T06:00:00Z", isCustomer: true, worker: null, ...over,
});
const detail = (over: object = {}) => ({
  user: {
    ...user(), suspensionReason: null, updatedAt: "2026-09-02T06:00:00Z", customerProfile: { id: "c1", displayName: "Rahim", preferredDivision: "Dhaka" }, activeSessions: 2,
    counts: { bookingsAsCustomer: 3, bookingsAsWorker: 0, supportTickets: 1, reportsFiled: 0, posts: 4, reviews: 2 },
    recentActions: [{ id: "a1", action: "user.suspend", createdAt: "2026-09-03T06:00:00Z", by: "Admin", reason: "Abuse" }],
    ...over,
  },
});
const role = (over: object = {}) => ({
  id: "r1", key: "support_agent", name: "Support agent", description: "Answers tickets", isSystem: false, permissions: ["users.read"], effectivePermissions: ["users.read"], holders: 0,
  createdAt: "2026-09-01T06:00:00Z", updatedAt: "2026-09-01T06:00:00Z", ...over,
});
const superRole = role({ id: "r0", key: "super_admin", name: "Super admin", isSystem: true, permissions: ["*"], effectivePermissions: ALL, holders: 1 });
const catalog = {
  groups: [
    { id: "people", label: "People and access", permissions: [
      { key: "users.read", label: "View users", description: "Search users.", sensitive: true },
      { key: "users.suspend", label: "Suspend accounts", description: "Suspend or restore." },
    ] },
    { id: "gov", label: "Governance", permissions: [{ key: "settings.manage", label: "Change platform settings", description: "Change settings.", sensitive: true }] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.mockReset();
  requested.length = 0;
  for (const k of Object.keys(data)) delete data[k];
});

describe("users list", () => {
  it("renders real rows that link to the detail page, with paging", () => {
    data["/admin/users"] = { users: [user(), user({ id: "user-def-456", name: "Karim", suspended: true, role: "ADMIN", adminRole: { id: "r1", key: "ops", name: "Operations" }, isCustomer: false, worker: { id: "w1", verificationStatus: "PENDING", published: false } })], page: 1, pageSize: 20, total: 45, totalPages: 3 };
    renderAs(ALL, <UsersList />);
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rahim Uddin" })).toHaveAttribute("href", "/admin/users/user-abc-123");
    expect(within(screen.getByRole("table")).getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText("Admin: Operations")).toBeInTheDocument();
    expect(screen.getByText("Worker: pending review")).toBeInTheDocument();
    expect(screen.getByText(/45 users/)).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("sends filters to the API and resets to page 1", () => {
    data["/admin/users"] = { users: [user()], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    renderAs(ALL, <UsersList />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "suspended" } });
    fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "worker" } });
    fireEvent.change(screen.getByLabelText("Account role"), { target: { value: "ADMIN" } });
    expect(requested.at(-1)).toBe("/admin/users?role=ADMIN&status=suspended&kind=worker&page=1&pageSize=20");
  });

  it("shows an empty state and an error state", () => {
    data["/admin/users"] = { users: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
    const { unmount } = renderAs(ALL, <UsersList />);
    expect(screen.getByText("No users yet")).toBeInTheDocument();
    unmount();
    data["/admin/users"] = new Error("Something went wrong on our side. Please try again.");
    renderAs(ALL, <UsersList />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong on our side");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not call the API-gated page without users.read", () => {
    renderAs(["roles.read"], <UsersList />);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
  });
});

describe("user detail", () => {
  beforeEach(() => {
    data["/admin/users/user-abc-123"] = detail();
    data["/admin/roles"] = { roles: [role(), superRole] };
  });

  it("shows account facts, counts and recent admin actions", () => {
    renderAs(ALL, <UserDetailView id="user-abc-123" />);
    expect(screen.getByText("rahim@example.com", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Bookings as customer").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("user.suspend")).toBeInTheDocument();
    expect(screen.getByText("Reason: Abuse")).toBeInTheDocument();
  });

  it("hides action controls the admin lacks permission for", () => {
    renderAs(["users.read"], <UserDetailView id="user-abc-123" />);
    expect(screen.queryByRole("button", { name: "Suspend account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin access" })).not.toBeInTheDocument();
  });

  it("suspends with a required reason and confirm: true, explaining the sign-out", async () => {
    api.mockResolvedValue({ user: { id: "user-abc-123", suspended: true } });
    renderAs(["users.read", "users.suspend"], <UserDetailView id="user-abc-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Suspend account" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/signs this user out on every device/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Suspend account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Repeated abuse" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/users/user-abc-123/suspension", { method: "POST", body: { suspended: true, reason: "Repeated abuse", confirm: true } }));
    expect(await screen.findByText(/signed out everywhere/)).toBeInTheDocument();
  });

  it("offers Restore for a suspended account and shows the stored reason", () => {
    data["/admin/users/user-abc-123"] = detail({ suspended: true, suspensionReason: "Fraud" });
    renderAs(["users.read", "users.suspend"], <UserDetailView id="user-abc-123" />);
    expect(screen.getByText(/Fraud/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore account" })).toBeInTheDocument();
  });

  it("keeps the dialog open and shows the server's refusal message", async () => {
    api.mockRejectedValue(new ApiError(403, "You don't have permission to do that.", {}, "TARGET_TOO_POWERFUL"));
    renderAs(["users.read", "users.suspend"], <UserDetailView id="user-abc-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Suspend account" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Because" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend account" }));
    expect(await within(dialog).findByText(/more permissions than you/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not offer actions on your own account", () => {
    data["/admin/users/admin-self-1"] = detail({ id: "admin-self-1" });
    renderAs(ALL, <UserDetailView id="admin-self-1" />);
    expect(screen.getByText(/this is your own account/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend account" })).not.toBeInTheDocument();
  });

  it("assigns a role the admin may grant, with reason and confirm: true", async () => {
    api.mockResolvedValue({ user: {} });
    renderAs(["users.read", "roles.read", "admins.assign", "users.read"], <UserDetailView id="user-abc-123" />);
    // the super admin role needs permissions this admin lacks, and "support_agent" only needs users.read
    const select = screen.getByLabelText("Role to give");
    expect(within(select).queryByRole("option", { name: "Super admin" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 role is not listed/)).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "r1" } });
    fireEvent.click(screen.getByRole("button", { name: "Give admin access" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "New support hire" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Give admin access" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/users/user-abc-123/admin-access", { method: "POST", body: { roleId: "r1", reason: "New support hire", confirm: true } }));
  });

  it("removes admin access with roleId null", async () => {
    data["/admin/users/user-abc-123"] = detail({ role: "ADMIN", adminRole: { id: "r1", key: "support_agent", name: "Support agent" } });
    api.mockResolvedValue({ user: {} });
    renderAs(ALL, <UserDetailView id="user-abc-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove admin access" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Left the team" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove admin access" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/users/user-abc-123/admin-access", { method: "POST", body: { roleId: null, reason: "Left the team", confirm: true } }));
  });

  it("explains when the role list needs roles.read", () => {
    renderAs(["users.read", "admins.assign"], <UserDetailView id="user-abc-123" />);
    expect(screen.getByText(/needs the “View admin roles” permission/)).toBeInTheDocument();
    expect(requested).not.toContain("/admin/roles");
  });

  it("shows the API error when the role list is refused", () => {
    data["/admin/roles"] = new Error("You don't have permission to do that.");
    renderAs(ALL, <UserDetailView id="user-abc-123" />);
    expect(screen.getByText("You don't have permission to do that.")).toBeInTheDocument();
  });
});

describe("roles", () => {
  beforeEach(() => {
    data["/admin/roles"] = { roles: [superRole, role({ holders: 2 }), role({ id: "r2", key: "empty_role", name: "Empty role", holders: 0 })] };
    data["/admin/roles/permissions"] = catalog;
  });

  it("lists roles with key, holders and a read-only system badge", () => {
    renderAs(ALL, <RolesView />);
    expect(screen.getByText("super_admin")).toBeInTheDocument();
    expect(screen.getByText("System (read-only)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Super admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Super admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Support agent" })).toBeInTheDocument();
  });

  it("hides management controls without roles.manage", () => {
    renderAs(["roles.read"], <RolesView />);
    expect(screen.queryByRole("button", { name: "New role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View holders of Support agent" })).toBeInTheDocument();
  });

  it("blocks deleting a role that still has holders", () => {
    renderAs(ALL, <RolesView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Support agent" }));
    expect(screen.getByText(/2 administrators still hold this role/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes an unused role only after typing its key, sending confirmKey", async () => {
    api.mockResolvedValue({ deleted: true });
    renderAs(ALL, <RolesView />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Empty role" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete role" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Type “empty_role” to confirm/), { target: { value: "empty_role" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/roles/r2", { method: "DELETE", body: { confirmKey: "empty_role" } }));
  });

  it("shows holders of the selected role", () => {
    data["/admin/roles/r1"] = { role: { ...role({ holders: 1 }), users: [{ id: "u9", name: "Salma", email: "salma@example.com", suspended: false }] } };
    renderAs(ALL, <RolesView />);
    fireEvent.click(screen.getByRole("button", { name: "View holders of Support agent" }));
    expect(screen.getByRole("link", { name: "Salma" })).toHaveAttribute("href", "/admin/users/u9");
    expect(screen.getByText("salma@example.com")).toBeInTheDocument();
  });

  it("creates a role from the permission matrix, greying out permissions the admin lacks", async () => {
    api.mockResolvedValue({ role: role({ id: "r9", key: "new_role", name: "New role" }) });
    data["/admin/roles/r9"] = { role: { ...role({ id: "r9" }), users: [] } };
    renderAs(["roles.read", "roles.manage", "users.read"], <RolesView />);
    fireEvent.click(screen.getByRole("button", { name: "New role" }));
    expect(screen.getByLabelText(/Change platform settings/)).toBeDisabled();
    expect(screen.getAllByText("Sensitive").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/your own role does not include this permission/).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));
    expect(screen.getByText("Choose at least one permission.")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "new_role" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New role" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "For testing" } });
    fireEvent.click(screen.getByLabelText(/View users/));
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/roles", { method: "POST", body: { key: "new_role", name: "New role", description: "For testing", permissions: ["users.read"] } }));
  });

  it("shows the server's refusal when saving", async () => {
    api.mockRejectedValue(new ApiError(403, "You don't have permission to do that.", {}, "PERMISSION_ESCALATION"));
    render(
      <AdminProvider me={meWith(ALL)}>
        <RoleEditor role={role()} onSaved={vi.fn()} onCancel={vi.fn()} />
      </AdminProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/only give a role permissions that you hold yourself/)).toBeInTheDocument();
  });

  it("validates role input like the server does", () => {
    expect(validateRole({ key: "Bad Key", name: "x", description: "", permissions: [] }, true)).toMatchObject({ key: expect.any(String), name: expect.any(String), description: expect.any(String), permissions: expect.any(String) });
    expect(validateRole({ key: "ok_key", name: "Fine", description: "d", permissions: ["users.read"] }, true)).toEqual({});
  });
});

describe("audit log", () => {
  const entry = { id: "e1", seq: 41, action: "user.suspend", targetType: "User", targetId: "user-abc-123", metadata: { reason: "Abuse", signedOutDevices: 2 }, createdAt: "2026-09-03T06:00:00Z", hash: "ab".repeat(32), actor: { id: "admin-1", name: "Salma Admin", email: "s@example.com" } };
  beforeEach(() => {
    data["/admin/audit/actions"] = { actions: ["user.suspend", "user.restore", "role.create"] };
    data["/admin/audit"] = { entries: [entry, { ...entry, id: "e2", seq: 40, metadata: null, actor: null }], page: 1, pageSize: 25, total: 2, totalPages: 1 };
  });

  it("lists entries newest first with expandable formatted metadata", () => {
    const { container } = renderAs(ALL, <AuditView />);
    expect(screen.getByText("#41")).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(2);
    expect(container.querySelector("pre")?.textContent).toContain('"reason": "Abuse"');
    expect(screen.getByText("No details were recorded.")).toBeInTheDocument();
    expect(screen.getByText("by system")).toBeInTheDocument();
  });

  it("offers action prefixes from the server's action list and filters by them", () => {
    renderAs(ALL, <AuditView />);
    const select = screen.getByLabelText("Action");
    expect(within(select).getByRole("option", { name: "user.* (all)" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "user.*" } });
    expect(lastAudit()).toContain("action=user.*");
    expect(lastAudit()).toContain("page=1&pageSize=25");
  });

  it("converts the date filters to Bangladesh-time instants", () => {
    renderAs(ALL, <AuditView />);
    fireEvent.change(screen.getByLabelText("From (Bangladesh time)"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To (Bangladesh time)"), { target: { value: "2026-09-02" } });
    const last = decodeURIComponent(lastAudit());
    expect(last).toContain("from=2026-09-01T00:00:00+06:00");
    expect(last).toContain("to=2026-09-02T23:59:59.999+06:00");
  });

  it("exports a CSV with the current filters", async () => {
    downloadFile.mockResolvedValue(undefined);
    renderAs(ALL, <AuditView />);
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "role.create" } });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith("/admin/audit/export?action=role.create", "audit-log.csv"));
  });

  it("shows an export failure", async () => {
    downloadFile.mockRejectedValue(new Error("Too many exports. Wait a minute and try again."));
    renderAs(ALL, <AuditView />);
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(await screen.findByText("Too many exports. Wait a minute and try again.")).toBeInTheDocument();
  });

  it("verifies integrity and shows a valid result with a copyable head hash", async () => {
    api.mockResolvedValue({ valid: true, checked: 41, headSeq: 41, headHash: "cd".repeat(32), firstInvalidSeq: null, problems: { contentChanged: false, chainBroken: false, gapOrReorder: false }, checkedAt: "2026-09-04T06:00:00Z" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderAs(ALL, <AuditView />);
    expect(screen.getByText(/someone with full database access/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify integrity" }));
    expect(await screen.findByText("Chain is valid")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/admin/audit/verify");
    expect(screen.getByText("cd".repeat(32))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy hash" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("cd".repeat(32)));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("shows an invalid chain with the first bad entry and the problem", async () => {
    api.mockResolvedValue({ valid: false, checked: 41, headSeq: 41, headHash: "ef".repeat(32), firstInvalidSeq: 17, problems: { contentChanged: true, chainBroken: false, gapOrReorder: false }, checkedAt: "2026-09-04T06:00:00Z" });
    renderAs(ALL, <AuditView />);
    fireEvent.click(screen.getByRole("button", { name: "Verify integrity" }));
    expect(await screen.findByText("Chain is NOT valid")).toBeInTheDocument();
    expect(screen.getByText("#17")).toBeInTheDocument();
    expect(screen.getByText(/content of an entry was changed/)).toBeInTheDocument();
  });

  it("hides verification without audit.verify", () => {
    renderAs(["audit.read"], <AuditView />);
    expect(screen.queryByRole("button", { name: "Verify integrity" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  });

  it("has an empty state when filters match nothing", () => {
    data["/admin/audit"] = { entries: [], page: 1, pageSize: 25, total: 0, totalPages: 0 };
    renderAs(ALL, <AuditView />);
    expect(screen.getByText("The audit log is empty")).toBeInTheDocument();
  });
});

describe("settings", () => {
  const settings = [
    { key: "platform.maintenanceMode", group: "Platform", label: "Maintenance mode", description: "Blocks changes.", effect: "Global guard.", type: "boolean", value: false, default: false, isDefault: true, updatedAt: null },
    { key: "platform.maintenanceMessage", group: "Platform", label: "Maintenance message", description: "Shown while on.", effect: "Returned by config.", type: "string", value: "", default: "", isDefault: true, updatedAt: null },
    { key: "finance.commissionBps", group: "Finance", label: "Commission rate (basis points)", description: "100 = 1%.", effect: "Commission report.", type: "number", value: 250, default: 0, isDefault: false, updatedAt: "2026-09-01T06:00:00Z" },
  ];
  beforeEach(() => { data["/admin/settings"] = { settings }; });

  it("groups settings and shows value, default and whether it is the default", () => {
    renderAs(ALL, <SettingsView />);
    expect(screen.getByRole("heading", { level: 2, name: "Platform" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Finance" })).toBeInTheDocument();
    expect(screen.getByText("Changed from default")).toBeInTheDocument();
    expect(screen.getAllByText("Default value")).toHaveLength(2);
    expect(screen.getByRole("switch", { name: "Maintenance mode" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Maintenance mode is OFF/)).toBeInTheDocument();
  });

  it("asks for a reason and says what turning maintenance mode on does, then PUTs the value", async () => {
    api.mockResolvedValue({ setting: {} });
    renderAs(ALL, <SettingsView />);
    fireEvent.click(screen.getByRole("switch", { name: "Maintenance mode" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/blocks every change that customers and workers try to make/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled(); // nothing is saved before the confirmation
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Database migration" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/settings/platform.maintenanceMode", { method: "PUT", body: { value: true, reason: "Database migration" } }));
    expect(await screen.findByText(/is now On/)).toBeInTheDocument();
  });

  it("sends numbers as numbers and rejects non-integers before asking", async () => {
    api.mockResolvedValue({ setting: {} });
    renderAs(ALL, <SettingsView />);
    const input = screen.getByLabelText("Commission rate (basis points)");
    const review = within(input.closest("div")!.parentElement!.parentElement!).getByRole("button", { name: "Review change" });
    expect(review).toBeDisabled();
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.click(review);
    expect(screen.getByText("Enter a whole number.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.click(review);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Agreed rate" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/settings/finance.commissionBps", { method: "PUT", body: { value: 300, reason: "Agreed rate" } }));
  });

  it("keeps the dialog open with the server's message on failure", async () => {
    api.mockRejectedValue(new ApiError(409, "That is already the current value", {}, "NO_CHANGE"));
    renderAs(ALL, <SettingsView />);
    fireEvent.click(screen.getByRole("switch", { name: "Maintenance mode" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Testing" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save change" }));
    expect(await within(dialog).findByText("That is already the current value")).toBeInTheDocument();
  });

  it("is read-only without settings.manage", () => {
    renderAs(["settings.read"], <SettingsView />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review change" })).not.toBeInTheDocument();
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });
});
