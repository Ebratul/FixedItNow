import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ProfessionalCard,
  type ProfessionalSummary,
} from "@/components/professional/professional-card";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { TextInput } from "@/components/ui/text-input";

const base: ProfessionalSummary = {
  id: "1",
  name: "Test Worker",
  category: "Plumbing",
  location: "Dhaka",
  rating: null,
  reviewCount: 0,
  verification: "PENDING",
};

describe("ProfessionalCard", () => {
  it("shows the Verified badge only for VERIFIED status", () => {
    const { rerender } = render(<ProfessionalCard pro={{ ...base, verification: "VERIFIED" }} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
    for (const status of ["NOT_SUBMITTED", "PENDING", "REJECTED", "RESUBMISSION_REQUIRED"] as const) {
      rerender(<ProfessionalCard pro={{ ...base, verification: status }} />);
      expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    }
  });
  it("shows 'No reviews yet' instead of a made-up rating", () => {
    render(<ProfessionalCard pro={base} />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });
});

describe("Rating", () => {
  it("renders real aggregates", () => {
    render(<Rating value={4.5} reviewCount={12} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
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
