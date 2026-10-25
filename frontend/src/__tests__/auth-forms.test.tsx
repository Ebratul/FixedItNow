import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const sendVerificationOtp = vi.fn();
const verifyFetch = vi.fn();
const requestPasswordReset = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...a: unknown[]) => signIn(...a), social: vi.fn() },
    signUp: { email: (...a: unknown[]) => signUp(...a) },
    emailOtp: { sendVerificationOtp: (...a: unknown[]) => sendVerificationOtp(...a) },
    $fetch: (...a: unknown[]) => verifyFetch(...a),
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
import { VerifyCodeForm } from "@/components/auth/verify-code-form";

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  sendVerificationOtp.mockResolvedValue({ error: null });
  verifyFetch.mockResolvedValue({ data: { status: true }, error: null });
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

  it("moves to the code step (and asks for a code) when the email is unverified", async () => {
    signIn.mockResolvedValue({ error: { status: 403, message: "" } });
    render(<LoginForm />);
    type("Email", "a@example.com");
    type("Password", "right-password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter your verification code")).toBeInTheDocument();
    await waitFor(() => expect(sendVerificationOtp).toHaveBeenCalledTimes(1));
    expect(sendVerificationOtp).toHaveBeenCalledWith({ email: "a@example.com", type: "email-verification" });
    expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled(); // no navigation until the code is verified
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

  it("moves to the code step identically whether or not the email exists, only after success", async () => {
    signUp.mockResolvedValue({ data: { token: null }, error: null });
    render(<RegisterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your verification code")).toBeInTheDocument();
    expect(screen.getByText(/can be used for an account/)).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith({ name: "Karim Uddin", email: "karim@example.com", password: "correct-horse-battery" });
    expect(window.location.href).not.toContain("karim"); // nothing about the account is put in the URL
  });

  it("does not claim success when the server fails", async () => {
    signUp.mockResolvedValue({ data: null, error: { status: 500, message: "boom" } });
    render(<RegisterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/couldn't create your account/)).toBeInTheDocument();
    expect(screen.queryByText("Enter your verification code")).not.toBeInTheDocument();
  });

  it("never sends a role or any extra privilege field", async () => {
    signUp.mockResolvedValue({ data: {}, error: null });
    render(<RegisterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(Object.keys(signUp.mock.calls[0][0]).sort()).toEqual(["email", "name", "password"]);
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


describe("VerifyCodeForm", () => {
  const embedded = (props: object = {}) => render(<VerifyCodeForm email="karim@example.com" password="correct-horse-battery" startCooldown {...props} />);
  const enter = (value: string) => fireEvent.change(screen.getByLabelText("6-digit code", { exact: true }), { target: { value } });
  const verify = () => fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  /** One second at a time: the countdown re-arms its timer after every render. */
  const tick = async (seconds: number) => {
    for (let i = 0; i < seconds; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  };

  it("accepts only digits, at most six, and enables the button only for a full code", () => {
    embedded();
    const button = screen.getByRole("button", { name: "Verify email" });
    expect(button).toBeDisabled();
    enter("12a-3 4");
    expect(screen.getByLabelText("6-digit code", { exact: true })).toHaveValue("1234");
    enter("123 456 789");
    expect(screen.getByLabelText("6-digit code", { exact: true })).toHaveValue("123456");
    expect(button).toBeEnabled();
  });

  it("sends the email, code and chosen password to the server, and navigates only after success", async () => {
    embedded({ next: "/onboarding/worker" });
    enter("123456");
    verify();
    await waitFor(() => expect(verifyFetch).toHaveBeenCalledWith("/email-otp/verify-email", { method: "POST", body: { email: "karim@example.com", otp: "123456", password: "correct-horse-battery" } }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding/worker"));
  });

  it("never navigates to an open-redirect target", async () => {
    embedded({ next: "https://evil.example" });
    enter("123456");
    verify();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it.each([
    [{ status: 400, code: "INVALID_OTP" }, /code or password isn't right/],
    [{ status: 400, code: "OTP_EXPIRED" }, /has expired/],
    [{ status: 403, code: "TOO_MANY_ATTEMPTS" }, /Too many wrong codes/],
    [{ status: 429 }, /Too many attempts/],
    [{ status: 500 }, /couldn't verify/],
  ])("explains %j without navigating or echoing the code", async (error, text) => {
    verifyFetch.mockResolvedValue({ data: null, error });
    embedded();
    enter("654321");
    verify();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("654321");
    expect(screen.getByLabelText("6-digit code", { exact: true })).toHaveValue(""); // cleared for a fresh try
  });

  it("blocks resending during the cooldown, counts down, then asks the server and answers neutrally", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      embedded();
      const resend = () => screen.getByRole("button", { name: /Send a new code/ });
      expect(resend()).toBeDisabled();
      expect(resend().textContent).toMatch(/in 60s/);
      await tick(30);
      expect(resend().textContent).toMatch(/in 30s/);
      expect(sendVerificationOtp).not.toHaveBeenCalled();
      await tick(31);
      expect(resend()).toBeEnabled();
      fireEvent.click(resend());
      await waitFor(() => expect(sendVerificationOtp).toHaveBeenCalledWith({ email: "karim@example.com", type: "email-verification" }));
      expect(await screen.findByText(/If this address is waiting to be verified/)).toBeInTheDocument();
      expect(resend()).toBeDisabled(); // cooldown restarts
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a rate-limited resend honestly", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      sendVerificationOtp.mockResolvedValue({ error: { status: 429 } });
      embedded({ startCooldown: false });
      fireEvent.click(screen.getByRole("button", { name: /Send a new code/ }));
      expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("standalone mode asks for email, password and code, and validates before calling the server", async () => {
    render(<VerifyCodeForm />);
    enter("123456");
    verify();
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter the password you chose")).toBeInTheDocument();
    expect(verifyFetch).not.toHaveBeenCalled();
    type("Email", "karim@example.com");
    type("Password", "correct-horse-battery");
    verify();
    await waitFor(() => expect(verifyFetch).toHaveBeenCalledTimes(1));
  });

  it("never asks for a code when it is not needed (no request on render)", () => {
    embedded();
    expect(sendVerificationOtp).not.toHaveBeenCalled();
    expect(verifyFetch).not.toHaveBeenCalled();
  });
});
