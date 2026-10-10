import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ToySprite } from "@/components/minigames/ToySprite";

afterEach(cleanup);

describe("toy sprite presentation", () => {
  it("shows the rabbit for book and falls back to the book emoji on image failure", () => {
    const { container } = render(<ToySprite asset="book" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/assets/toys/rabbit__normal.webp");
    expect(img.draggable).toBe(false);
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("📕");
  });

  it.each(["teddy", "car"] as const)(
    "switches %s poses and recovers from a failed possessed image",
    (asset) => {
      const { container, rerender } = render(<ToySprite asset={asset} possessed />);
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        `/assets/toys/${asset}__possessed.webp`,
      );
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();
      expect(container.textContent).not.toBe("");
      rerender(<ToySprite asset={asset} />);
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        `/assets/toys/${asset}__normal.webp`,
      );
    },
  );

  it("keeps the normal sprite with a CSS effect for other possessed toys", () => {
    const { container } = render(<ToySprite asset="robot" possessed />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/assets/toys/robot__normal.webp");
    expect(img.style.filter).toContain("drop-shadow");
  });
});
