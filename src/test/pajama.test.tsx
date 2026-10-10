import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PajamaMinigame } from "@/components/minigames/PajamaMinigame";
import { STORY_LEVELS } from "@/game/levels/defaultLevels";

afterEach(cleanup);

describe("MG05 - pajamas and the laundry basket", () => {
  const make = (favoriteColor: "green" | "blue" | "pink") => {
    const onComplete = vi.fn();
    render(
      <PajamaMinigame
        level={STORY_LEVELS.task_three}
        memory={{ favoriteColor }}
        dark={false}
        onComplete={onComplete}
      />,
    );
    return onComplete;
  };

  it("the player's chosen color is used for shirt, pants and socks", () => {
    make("green");
    for (const piece of ["Shirt", "Pants", "Socks"]) {
      fireEvent.click(screen.getByRole("button", { name: "green " + piece }));
    }
    expect(screen.getByText("Pajamas: 3/3")).toBeTruthy();
    expect(screen.getByText(/Put all other clothes in the basket/)).toBeTruthy();
  });

  it("only finishes when all mismatched clothes have been tidied", () => {
    const done = make("pink");
    for (const piece of ["Shirt", "Pants", "Socks"]) {
      fireEvent.click(screen.getByRole("button", { name: "pink " + piece }));
    }
    expect(done).not.toHaveBeenCalled();
    const leftovers = screen.getAllByRole("button").filter((button) => {
      const label = button.getAttribute("aria-label") ?? "";
      return (label.includes("Shirt") || label.includes("Pants") || label.includes("Socks")) &&
        !label.startsWith("pink ");
    });
    expect(leftovers).toHaveLength(9);
    leftovers.forEach((button) => fireEvent.click(button));
    expect(screen.getByText("Basket: 9/9")).toBeTruthy();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("wrong colors cannot be equipped as pajamas", () => {
    make("blue");
    fireEvent.click(screen.getByRole("button", { name: "red Shirt" }));
    expect(screen.getByText(/That color isn't yours/)).toBeTruthy();
    expect(screen.getByText("Pajamas: 0/3")).toBeTruthy();
  });
});
