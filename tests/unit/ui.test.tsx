import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";

describe("shared UI states (A11Y)", () => {
  it("renders an empty state with a clear message and action", () => {
    const { getByText, getByRole } = render(
      <EmptyState
        title="No goals yet"
        body="A goal can be a sentence."
        action={<a href="/new">Create</a>}
      />
    );
    expect(getByText("No goals yet")).toBeInTheDocument();
    expect(getByText("A goal can be a sentence.")).toBeInTheDocument();
    expect(getByRole("link", { name: "Create" })).toBeInTheDocument();
  });

  it("exposes progress to assistive technology", () => {
    const { getByRole, getByText } = render(<ProgressBar value={42} label="Progress" />);
    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(getByText("42%")).toBeInTheDocument();
  });

  it("clamps out-of-range progress values", () => {
    const { getByRole } = render(<ProgressBar value={150} />);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
