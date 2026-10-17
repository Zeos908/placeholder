/**
 * F7 onboarding (spec §17): progress dots, "Skip" top-right on every step, a big Next pinned to
 * the bottom that reads "Start exploring" on the last step, chips with checks, the radius slider,
 * and Next blocked while the username is taken.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingFlow } from "@/app/onboarding/OnboardingFlow";

const actions = vi.hoisted(() => ({
  updateProfile: vi.fn(async () => ({ ok: true as const })),
  completeOnboarding: vi.fn(async () => {}),
  checkUsername: vi.fn(async (name: string) => (name === "taken_name" ? "taken" : "available")),
}));
vi.mock("@/app/actions/profile", () => actions);

const initial = {
  username: "user_abc123",
  display_name: "",
  avatar_url: null,
  grade_level: null,
  school: "",
  interests: [],
  zip: "",
  radius_miles: 25,
  skills: [],
  bio: "",
};

beforeEach(() => {
  actions.updateProfile.mockClear();
  actions.completeOnboarding.mockClear();
});

describe("onboarding", () => {
  it("walks 4 steps with dots and a final Start exploring", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow userId="u1" initial={initial} />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress.querySelectorAll("span")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();

    for (const n of [2, 3, 4]) {
      await user.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(n)));
    }
    expect(screen.getByRole("button", { name: "Start exploring" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "25");

    await user.click(screen.getByRole("button", { name: "Start exploring" }));
    await waitFor(() => expect(actions.completeOnboarding).toHaveBeenCalled());
  });

  it("Skip moves on without saving that step; on the last step it finishes", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow userId="u1" initial={initial} />);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    expect(actions.updateProfile).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(actions.completeOnboarding).toHaveBeenCalled());
  });

  it("interest chips show a check and the gradient border when picked", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow userId="u1" initial={initial} />);
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    const coding = screen.getByRole("button", { name: "Coding" });
    expect(coding).toHaveAttribute("aria-pressed", "false");
    await user.click(coding);
    expect(coding).toHaveAttribute("aria-pressed", "true");
    expect(coding.className).toContain("border-accent-gradient");
    expect(coding.querySelector("svg")).not.toBeNull();
  });

  it("Next is blocked while the username is taken", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow userId="u1" initial={initial} />);
    const field = screen.getByLabelText("Username");
    await user.clear(field);
    await user.type(field, "taken_name");
    await waitFor(() => expect(screen.getByText("Already taken")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
