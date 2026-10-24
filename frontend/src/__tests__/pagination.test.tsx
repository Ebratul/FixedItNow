import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination, pageWindow } from "@/components/ui/pagination";

describe("pageWindow", () => {
  it("shows first, last and neighbours with ellipses", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, "…", 10]);
  });
});

describe("Pagination", () => {
  const hrefFor = (p: number) => `/workers?page=${p}`;
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} hrefFor={hrefFor} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("marks the current page and links neighbours", () => {
    render(<Pagination page={2} totalPages={4} hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute("href", "/workers?page=1");
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/workers?page=3");
  });
  it("disables previous on the first page", () => {
    render(<Pagination page={1} totalPages={3} hrefFor={hrefFor} />);
    expect(screen.queryByRole("link", { name: /Previous/ })).not.toBeInTheDocument();
  });
});
