import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/admin/workers" }));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
const data: Record<string, unknown> = {};
const refresh = vi.fn();
const requested: string[] = [];
vi.mock("@/lib/use-api", () => ({
  useApi: (path: string) => {
    requested.push(path);
    const key = Object.keys(data).find((k) => path.startsWith(k));
    return { state: key ? { status: "ready", data: data[key] } : { status: "loading" }, reload: vi.fn(), refresh, stale: false };
  },
}));

import { AdminProvider } from "@/components/admin/shell/admin-context";
import { CategoryManager } from "@/components/admin/categories/category-manager";
import { WorkerDetail } from "@/components/admin/workers/worker-detail";
import { WorkerList } from "@/components/admin/workers/worker-list";
import { IdentityDocuments, checkDocumentFile } from "@/components/onboarding/identity-documents";
import { ApiError } from "@/lib/api";
import { flattenCategories } from "@/lib/worker-onboarding";
import type { Me } from "@/lib/use-api";

const meWith = (permissions: string[]) =>
  ({ user: { id: "admin-1", name: "A", email: "a@x.test", emailVerified: true, image: null }, isAdmin: true, admin: { role: { key: "r", name: "Reviewer" }, permissions }, customer: { onboarded: false }, worker: { started: false, approved: false } }) as Me;
const wrap = (permissions: string[], ui: React.ReactNode) => render(<AdminProvider me={meWith(permissions)}>{ui}</AdminProvider>);

const ID = "11111111-1111-4111-8111-111111111111";
const worker = (over: Record<string, unknown> = {}) => ({
  id: ID, userId: "u9", onboardingStatus: "SUBMITTED", displayName: "Rahim Uddin", headline: "Electrician", bio: "<b>Wiring</b> expert", experienceYears: 8,
  languages: ["Bangla"], serviceAreas: ["Dhaka"], submittedAt: "2026-10-20T06:00:00Z", verificationStatus: "PENDING", reviewNote: null, reviewedAt: null, reviewedBy: null,
  publishedAt: null, slug: null, suspendedAt: null, suspensionReason: null, startingPriceBdt: 500, published: false, suspended: false,
  services: [{ pricingModel: "FIXED", basePriceBdt: 500, category: { name: "Electrical", slug: "electrical" } }],
  documents: [{ kind: "NID_FRONT", mimeType: "image/jpeg", sizeBytes: 204800, uploadedAt: "2026-10-20T05:00:00Z" }],
  user: { id: "u9", name: "Rahim", email: "rahim@example.test", suspended: false },
  isOwnProfile: false, documentsRequired: true, missingDocuments: ["NID_BACK"], history: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.mockReset();
  requested.length = 0;
  for (const k of Object.keys(data)) delete data[k];
});

describe("worker list", () => {
  it("defaults to pending, shows real rows and builds the query", () => {
    data["/admin/workers"] = {
      page: 1, pageSize: 25, total: 1, totalPages: 1,
      workers: [{ id: ID, displayName: "Rahim Uddin", email: "rahim@example.test", submittedAt: "2026-10-20T06:00:00Z", verificationStatus: "PENDING", published: false, suspended: false, categories: ["Electrical"], documentCount: 2 }],
    };
    wrap(["workers.read"], <WorkerList />);
    expect(requested[0]).toBe("/admin/workers?status=PENDING&page=1&pageSize=25");
    expect(screen.getByRole("link", { name: "Rahim Uddin" })).toHaveAttribute("href", `/admin/workers/${ID}`);
    expect(within(screen.getByRole("table")).getByText("Awaiting review")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Documents" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(requested.at(-1)).toContain("status=VERIFIED");
  });

  it("shows an empty state", () => {
    data["/admin/workers"] = { page: 1, pageSize: 25, total: 0, totalPages: 0, workers: [] };
    wrap(["workers.read"], <WorkerList />);
    expect(screen.getByText(/No worker applications are waiting for review/)).toBeInTheDocument();
  });
});

describe("worker detail", () => {
  it("shows facts as plain text, the account email and missing documents", () => {
    data[`/admin/workers/${ID}`] = { worker: worker() };
    wrap(["workers.read"], <WorkerDetail id={ID} />);
    expect(screen.getByText("<b>Wiring</b> expert")).toBeInTheDocument();
    expect(screen.getByText(/rahim@example.test/)).toBeInTheDocument();
    expect(screen.getByText(/Still to be uploaded: National ID, back/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
  });

  it("does not load any image until View is clicked, and hides View without the permission", () => {
    data[`/admin/workers/${ID}`] = { worker: worker() };
    const { container, unmount } = wrap(["workers.read"], <WorkerDetail id={ID} />);
    expect(screen.queryByRole("button", { name: /View/ })).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    unmount();

    const view = wrap(["workers.read", "workers.documents.view"], <WorkerDetail id={ID} />);
    expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByText("This view is recorded in the audit log.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View National ID, front" }));
    const img = view.container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(`/api/v1/admin/workers/${ID}/documents/NID_FRONT`);
    fireEvent.error(img);
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
    expect(view.container.querySelector("img")).toBeNull();
  });

  it("requires a note to reject, then sends decision and note", async () => {
    data[`/admin/workers/${ID}`] = { worker: worker() };
    api.mockResolvedValue({ worker: {} });
    wrap(["workers.read", "workers.review"], <WorkerDetail id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    const confirm = within(dialog).getByRole("button", { name: "Reject", hidden: true });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Photo does not match" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/workers/${ID}/verification`, { method: "POST", body: { decision: "REJECTED", note: "Photo does not match" } }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("keeps the dialog open and shows the server error (DOCUMENTS_REQUIRED)", async () => {
    data[`/admin/workers/${ID}`] = { worker: worker() };
    api.mockRejectedValue(new ApiError(422, "Both sides of the identity document must be uploaded before this worker can be verified", {}, "DOCUMENTS_REQUIRED"));
    wrap(["workers.read", "workers.review"], <WorkerDetail id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Approve", hidden: true }));
    expect(await screen.findByText(/Both sides of the identity document/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows only a notice for the admin's own profile", () => {
    data[`/admin/workers/${ID}`] = { worker: worker({ isOwnProfile: true }) };
    wrap(["workers.read", "workers.review", "workers.suspend"], <WorkerDetail id={ID} />);
    expect(screen.getByText(/This is your own worker profile/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend profile" })).not.toBeInTheDocument();
  });

  it("suspends with a required reason and restores without one", async () => {
    data[`/admin/workers/${ID}`] = { worker: worker({ verificationStatus: "VERIFIED" }) };
    api.mockResolvedValue({ worker: {} });
    const first = wrap(["workers.read", "workers.suspend"], <WorkerDetail id={ID} />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suspend profile" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Fake documents reported" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/workers/${ID}/suspension`, { method: "POST", body: { suspended: true, reason: "Fake documents reported" } }));
    first.unmount();

    api.mockClear();
    data[`/admin/workers/${ID}`] = { worker: worker({ verificationStatus: "VERIFIED", suspended: true, suspendedAt: "2026-10-21T06:00:00Z", suspensionReason: "Fake documents reported" }) };
    wrap(["workers.read", "workers.suspend"], <WorkerDetail id={ID} />);
    expect(screen.getByText("Fake documents reported")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore profile" }));
    fireEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Restore", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/workers/${ID}/suspension`, { method: "POST", body: { suspended: false } }));
  });
});

const child = (over: object = {}) => ({ id: "c1", slug: "fan-repair", name: "Fan repair", description: "Fans", sortOrder: 0, isActive: true, parentId: "p1", workers: 0, bookings: 0, subcategories: 0, createdAt: "", updatedAt: "", ...over });
const tree = () => ({
  categories: [
    { id: "p1", slug: "electrical", name: "Electrical", description: "Wiring", sortOrder: 0, isActive: true, parentId: null, workers: 3, bookings: 7, subcategories: 2, createdAt: "", updatedAt: "", children: [child(), child({ id: "c2", slug: "wiring", name: "Wiring", sortOrder: 1, isActive: false })] },
    { id: "p2", slug: "plumbing", name: "Plumbing", description: "Pipes", sortOrder: 1, isActive: true, parentId: null, workers: 0, bookings: 0, subcategories: 0, createdAt: "", updatedAt: "", children: [] },
  ],
});

describe("category manager", () => {
  it("renders the tree with usage counts and marks inactive ones", () => {
    data["/admin/categories"] = tree();
    wrap(["catalog.read", "catalog.manage"], <CategoryManager />);
    expect(screen.getByText(/3 workers · 7 bookings · 2 subcategories/)).toBeInTheDocument();
    expect(screen.getByText("Inactive: hidden from the public site")).toBeInTheDocument();
    expect(screen.getByText(/hides it from the public site and from new bookings/)).toBeInTheDocument();
  });

  it("hides manage controls without catalog.manage", () => {
    data["/admin/categories"] = tree();
    wrap(["catalog.read"], <CategoryManager />);
    expect(screen.queryByRole("button", { name: /Edit|Delete|Move|New category/ })).not.toBeInTheDocument();
  });

  it("sends the full sibling list when moving down", async () => {
    data["/admin/categories"] = tree();
    api.mockResolvedValue({});
    wrap(["catalog.read", "catalog.manage"], <CategoryManager />);
    fireEvent.click(screen.getByRole("button", { name: "Move down: Electrical" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/categories/order", { method: "PUT", body: { parentId: null, ids: ["p2", "p1"] } }));
    fireEvent.click(await screen.findByRole("button", { name: "Move down: Fan repair" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/categories/order", { method: "PUT", body: { parentId: "p1", ids: ["c2", "c1"] } }));
    expect(screen.getByRole("button", { name: "Move up: Electrical" })).toBeDisabled();
  });

  it("validates and creates a subcategory", async () => {
    data["/admin/categories"] = tree();
    api.mockResolvedValue({ category: {} });
    wrap(["catalog.read", "catalog.manage"], <CategoryManager />);
    fireEvent.click(screen.getByRole("button", { name: "Add subcategory to Plumbing" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create", hidden: true }));
    expect(within(dialog).getByText("Use 2 to 60 characters")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Drain cleaning" } });
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "Clearing blocked drains" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/categories", { method: "POST", body: { name: "Drain cleaning", description: "Clearing blocked drains", parentId: "p2", isActive: true } }));
  });

  it("requires typing the slug to delete and shows the server's in-use message", async () => {
    data["/admin/categories"] = tree();
    api.mockRejectedValue(new ApiError(409, "Used by 3 worker service(s), 7 booking(s) and 2 subcategorie(s). Deactivate it instead.", {}, "CATEGORY_IN_USE"));
    wrap(["catalog.read", "catalog.manage"], <CategoryManager />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Electrical" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    const go = within(dialog).getByRole("button", { name: "Delete category", hidden: true });
    expect(go).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Type “electrical”/), { target: { value: "electrical" } });
    fireEvent.click(go);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/categories/p1", { method: "DELETE", body: { confirmSlug: "electrical" } }));
    expect(await within(dialog).findByText(/Deactivate it instead/)).toBeInTheDocument();
  });
});

describe("identity documents (worker side)", () => {
  const png = () => new File([new Uint8Array(2000)], "id.png", { type: "image/png" });

  it("checks type and size on the client", () => {
    expect(checkDocumentFile({ type: "application/pdf", size: 100 })).toMatch(/JPEG, PNG or WebP/);
    expect(checkDocumentFile({ type: "image/png", size: 4 * 1024 * 1024 })).toMatch(/3 MB/);
    expect(checkDocumentFile({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("lists status, uploads the raw file with its type, and maps error codes", async () => {
    data["/me/worker-profile/documents"] = { storageAvailable: true, documents: [{ kind: "NID_FRONT", mimeType: "image/jpeg", sizeBytes: 5000, uploadedAt: "2026-10-20T05:00:00Z" }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ code: "ALREADY_VERIFIED" }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<IdentityDocuments />);
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    const file = png();
    fireEvent.change(screen.getByLabelText(/for National ID, back/), { target: { files: [file] } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/worker-profile/documents/NID_BACK", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "image/png" }, body: file });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/for National ID, front/), { target: { files: [png()] } });
    expect(await screen.findByText(/already verified/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("rejects a wrong file without calling the server and explains when storage is off", async () => {
    data["/me/worker-profile/documents"] = { storageAvailable: true, documents: [] };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<IdentityDocuments />);
    fireEvent.change(screen.getByLabelText(/for National ID, back/), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText(/Only JPEG, PNG or WebP/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
    data["/me/worker-profile/documents"] = { storageAvailable: false, documents: [] };
    render(<IdentityDocuments />);
    expect(screen.getByText(/not available right now/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/for National ID, back/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("removes a document after confirmation", async () => {
    data["/me/worker-profile/documents"] = { storageAvailable: true, documents: [{ kind: "NID_FRONT", mimeType: "image/jpeg", sizeBytes: 5000, uploadedAt: "2026-10-20T05:00:00Z" }] };
    api.mockResolvedValue({});
    render(<IdentityDocuments />);
    fireEvent.click(screen.getByRole("button", { name: "Remove National ID, front" }));
    fireEvent.click(within(screen.getByRole("dialog", { hidden: true })).getByRole("button", { name: "Remove", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/me/worker-profile/documents/NID_FRONT", { method: "DELETE" }));
  });
});

describe("category picker", () => {
  it("offers parents and subcategories labelled Parent › Child", () => {
    const flat = flattenCategories([
      { slug: "electrical", name: "Electrical", description: "d", subcategories: [{ slug: "fan-repair", name: "Fan repair", description: "f" }] },
      { slug: "plumbing", name: "Plumbing", description: "p" },
    ]);
    expect(flat.map((c) => [c.slug, c.name])).toEqual([["electrical", "Electrical"], ["fan-repair", "Electrical › Fan repair"], ["plumbing", "Plumbing"]]);
  });
});
