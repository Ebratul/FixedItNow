import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/workers/test-1" }));
let session: { user: { id: string } } | null = null;
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: session, isPending: false }) },
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => api(...args),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import { FavoriteButton } from "@/components/professional/favorite-button";
import { resetFavoritesStore, syncFavoritesUser } from "@/lib/favorites-store";

const W = "0192a000-0000-7000-8000-000000000001";
const button = () => screen.getByRole("button", { name: /to favorites|from favorites/ });

beforeEach(() => {
  vi.clearAllMocks();
  resetFavoritesStore();
  session = null;
});

describe("FavoriteButton", () => {
  it("sends signed-out visitors to log in and back, without calling the API", () => {
    render(<FavoriteButton workerId={W} workerName="Rahim" />);
    fireEvent.click(button());
    expect(push).toHaveBeenCalledWith("/login?next=%2Fworkers%2Ftest-1");
    expect(api).not.toHaveBeenCalled();
  });

  it("reflects server state and toggles with the session user's endpoints", async () => {
    session = { user: { id: "u1" } };
    api.mockImplementation(async (path: string) => (path === "/me/favorites/ids" ? { ids: [W] } : { ok: true }));
    render(<FavoriteButton workerId={W} workerName="Rahim" />);
    await waitFor(() => expect(button()).toHaveAttribute("aria-pressed", "true"));
    expect(button()).toHaveAccessibleName("Remove Rahim from favorites");

    fireEvent.click(button());
    await waitFor(() => expect(button()).toHaveAttribute("aria-pressed", "false"));
    expect(api).toHaveBeenCalledWith(`/me/favorites/${W}`, { method: "DELETE", body: {} });
    // Identity is never sent by the browser.
    expect(JSON.stringify(api.mock.calls)).not.toContain("u1");
  });

  it("rolls back and reports when the server rejects the change", async () => {
    session = { user: { id: "u1" } };
    api.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/me/favorites/ids") return { ids: [] };
      if (init?.method === "PUT") throw new Error("boom");
      return {};
    });
    render(<FavoriteButton workerId={W} workerName="Rahim" />);
    await waitFor(() => expect(button()).not.toBeDisabled());
    fireEvent.click(button());
    expect(await screen.findByText(/Couldn't update favorites/)).toBeInTheDocument();
    expect(button()).toHaveAttribute("aria-pressed", "false");
  });

  it("clears cached favorites when the signed-in user changes", async () => {
    api.mockResolvedValue({ ids: [W] });
    act(() => syncFavoritesUser("user-a"));
    session = { user: { id: "user-a" } };
    const { rerender } = render(<FavoriteButton workerId={W} workerName="Rahim" />);
    await waitFor(() => expect(button()).toHaveAttribute("aria-pressed", "true"));

    api.mockResolvedValue({ ids: [] });
    session = { user: { id: "user-b" } };
    rerender(<FavoriteButton workerId={W} workerName="Rahim" />);
    await waitFor(() => expect(button()).toHaveAttribute("aria-pressed", "false"));
  });
});
