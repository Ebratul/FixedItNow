import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const social = vi.fn();
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { social: (...a: unknown[]) => social(...a) } } }));

let configState: unknown;
vi.mock("@/lib/use-api", () => ({ useAuthConfig: () => ({ state: configState, reload: vi.fn() }) }));

import { GoogleSection } from "@/components/auth/google-section";

beforeEach(() => {
  vi.clearAllMocks();
  social.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("GoogleSection", () => {
  it("shows the button when the backend reports Google is configured, and starts the OAuth flow", async () => {
    configState = { status: "ready", data: { googleEnabled: true } };
    render(<GoogleSection next="/account" />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() =>
      expect(social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/account",
        newUserCallbackURL: "/onboarding",
        errorCallbackURL: "/login",
      }),
    );
  });

  it("explains in production that Google is unavailable when it is not configured (no button, no internals)", () => {
    vi.stubEnv("NODE_ENV", "production");
    configState = { status: "ready", data: { googleEnabled: false } };
    render(<GoogleSection next="/" />);
    expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/unavailable.*email and password/i);
    expect(document.body.textContent).not.toMatch(/GOOGLE_CLIENT/);
  });

  it("also explains it when the configuration cannot be loaded", () => {
    vi.stubEnv("NODE_ENV", "production");
    configState = { status: "error", message: "boom" };
    render(<GoogleSection next="/" />);
    expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows a safe error when starting the flow fails", async () => {
    configState = { status: "ready", data: { googleEnabled: true } };
    social.mockResolvedValue({ error: { status: 500 } });
    render(<GoogleSection next="/" />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(await screen.findByText(/couldn't start Google sign-in/i)).toBeInTheDocument();
  });
});
