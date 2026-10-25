import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/workers" }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));

import { ProfessionalCard } from "@/components/professional/professional-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Rating } from "@/components/ui/rating";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import type { WorkerCardData } from "@/lib/discovery-types";

const base: WorkerCardData = {
  id: "0192a000-0000-7000-8000-000000000001",
  slug: "test-worker-1a2b3c4d",
  displayName: "Test Worker",
  headline: "Licensed electrician",
  primaryCategory: { slug: "electrical", name: "Electrical Services" },
  categories: [
    { slug: "electrical", name: "Electrical Services" },
    { slug: "plumbing", name: "Plumbing" },
    { slug: "painting", name: "Painting" },
  ],
  serviceAreas: ["Dhaka", "Sylhet"],
  experienceYears: 8,
  startingPriceBdt: 500,
  verification: "VERIFIED",
  rating: null,
  reviewCount: 0,
  publishedAt: "2026-10-24T00:00:00Z",
};

describe("ProfessionalCard", () => {
  it("renders the public projection and links to the slug-based profile", () => {
    render(<ProfessionalCard pro={base} />);
    expect(screen.getByRole("heading", { name: "Test Worker" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile of Test Worker" })).toHaveAttribute("href", "/workers/test-worker-1a2b3c4d");
    expect(screen.getByText("Dhaka, Sylhet")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("never invents ratings: no reviews means 'No reviews yet'", () => {
    render(<ProfessionalCard pro={base} />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("shows genuine rating data only when provided", () => {
    render(<ProfessionalCard pro={{ ...base, rating: 4.5, reviewCount: 12 }} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("shows 'Price on request' instead of a made-up price", () => {
    render(<ProfessionalCard pro={{ ...base, startingPriceBdt: null }} />);
    expect(screen.getByText("Price on request")).toBeInTheDocument();
  });

  it("shows the reviewed badge only for VERIFIED data", () => {
    const { rerender } = render(<ProfessionalCard pro={base} />);
    expect(screen.getByText("Profile reviewed")).toBeInTheDocument();
    rerender(<ProfessionalCard pro={{ ...base, verification: "PENDING" as unknown as "VERIFIED" }} />);
    expect(screen.queryByText("Profile reviewed")).not.toBeInTheDocument();
  });

  it("renders worker-provided text as text, not markup", () => {
    render(<ProfessionalCard pro={{ ...base, displayName: "<img src=x onerror=alert(1)>", headline: "<script>alert(1)</script>" }} />);
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("has an accessible favorite control", () => {
    render(<ProfessionalCard pro={base} />);
    expect(screen.getByRole("button", { name: "Save Test Worker to favorites" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Rating", () => {
  it("renders real aggregates", () => {
    render(<Rating value={4.5} reviewCount={12} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("is disabled and busy while loading", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("TextInput", () => {
  it("associates label and error with the input", () => {
    render(<TextInput id="x" label="Name" error="Required" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Required");
  });
});

describe("SelectInput", () => {
  it("renders an empty first option only when asked to, so a must-have-a-value select cannot submit nothing", () => {
    const options = [{ value: "24", label: "24 hours" }, { value: "48", label: "48 hours" }];
    const { rerender } = render(<SelectInput id="a" label="Valid for" placeholder="Choose" options={options} defaultValue="" />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose", "24 hours", "48 hours"]);
    rerender(<SelectInput id="a" label="Valid for" placeholder={null} options={options} defaultValue="24" />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["24 hours", "48 hours"]);
  });
});

describe("Dialog", () => {
  // jsdom has no <dialog> behaviour, so the dialog methods are stubbed; the handlers are what is under test.
  const stub = () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); });
  };

  it("ignores Escape while it is not dismissible (a request is in flight), and honours it otherwise", () => {
    stub();
    const onClose = vi.fn();
    const { container, rerender } = render(<Dialog open onClose={onClose} title="Confirm" dismissible={false}><p>body</p></Dialog>);
    const dialog = container.querySelector("dialog")!;
    const busy = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(busy);
    expect(busy.defaultPrevented).toBe(true);
    fireEvent.click(dialog); // backdrop click
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Dialog open onClose={onClose} title="Confirm"><p>body</p></Dialog>);
    const idle = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
