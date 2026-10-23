import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => search,
  usePathname: () => "/login",
}));

const signIn = vi.fn();
const signUp = vi.fn();
const sendVerificationEmail = vi.fn();
const requestPasswordReset = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...a: unknown[]) => signIn(...a), social: vi.fn() },
    signUp: { email: (...a: unknown[]) => signUp(...a) },
    sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
    requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a),
    useSession: () => ({ data: null, isPending: false }),
  },
}));
vi.mock("@/lib/use-api", () => ({
  useAuthConfig: () => ({ state: { status: "ready", data: { googleEnabled: false } }, reload: vi.fn() }),
}));

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
});

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

describe("LoginForm", () => {
  it("shows validation errors and does not call the server", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("navigates only after the server confirms success, honouring a safe ?next", async () => {
    search = new URLSearchParams("next=/onboarding/worker");
    signIn.mockResolvedValue({ error: null });
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "secret-secret");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding/worker"));
  });

  it("ignores an open-redirect ?next", async () => {
    search = new URLSearchParams("next=https://evil.example");
    signIn.mockResolvedValue({ error: null });
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "secret-secret");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account"));
  });

  it("shows one generic message for bad credentials and does not navigate", async () => {
    signIn.mockResolvedValue({ error: { status: 401, message: "Invalid email or password" } });
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("explains rate limiting", async () => {
    signIn.mockResolvedValue({ error: { status: 429, message: "" } });
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument();
  });

  it("requests a fresh verification link when the email is unverified", async () => {
    signIn.mockResolvedValue({ error: { status: 403, message: "" } });
    sendVerificationEmail.mockResolvedValue({ error: null });
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "right-password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText(/isn't verified yet/)).toBeInTheDocument();
    expect(sendVerificationEmail).toHaveBeenCalledWith({ email: "a@example.com", callbackURL: "/verify-email" });
  });

  it("prevents double submission while the request is in flight", async () => {
    let resolve!: (v: unknown) => void;
    signIn.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "secret-secret");
    const button = screen.getByRole("button", { name: "Log in" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: /Logging in/ })).toBeDisabled());
    fireEvent.submit(button.closest("form")!);
    expect(signIn).toHaveBeenCalledTimes(1);
    resolve({ error: null });
  });

  it("maps Google OAuth error codes to safe messages", () => {
    search = new URLSearchParams("error=account_not_linked");
    render(<LoginForm />);
    expect(screen.getByText(/connect Google from your account page/)).toBeInTheDocument();
  });
});

describe("RegisterForm", () => {
  const fill = (password = "correct-horse-battery", confirm = password) => {
    type("Full name", "Karim Uddin");
    type("Email", "karim@example.com");
    type("Password", password);
    type("Confirm password", confirm);
  };

  it("validates on the client first", async () => {
    render(<RegisterForm />);
    fill("short", "other");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Use at least 10 characters")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows the same confirmation whether or not the email exists, only after success", async () => {
    signUp.mockResolvedValue({ data: { token: null }, error: null });
    render(<RegisterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(/If/).textContent).toMatch(/can be used to create an account/);
    expect(signUp).toHaveBeenCalledWith({ name: "Karim Uddin", email: "karim@example.com", password: "correct-horse-battery", callbackURL: "/verify-email" });
  });

  it("does not claim success when the server fails", async () => {
    signUp.mockResolvedValue({ data: null, error: { status: 500, message: "boom" } });
    render(<RegisterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/couldn't create your account/)).toBeInTheDocument();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("never sends a role or any extra privilege field", async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    render(<RegisterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(Object.keys(signUp.mock.calls[0][0]).sort()).toEqual(["callbackURL", "email", "name", "password"]);
  });
});

describe("ForgotPasswordForm", () => {
  it("gives the same confirmation for any address", async () => {
    requestPasswordReset.mockResolvedValue({ error: null });
    render(<ForgotPasswordForm />);
    type("Email", "anyone@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: "anyone@example.com", redirectTo: "/reset-password" });
  });

  it("reports failures instead of pretending success", async () => {
    requestPasswordReset.mockResolvedValue({ error: { status: 500, message: "x" } });
    render(<ForgotPasswordForm />);
    type("Email", "anyone@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/couldn't send the request/)).toBeInTheDocument();
    expect(screen.queryByText(/If an account exists/)).not.toBeInTheDocument();
  });
});
