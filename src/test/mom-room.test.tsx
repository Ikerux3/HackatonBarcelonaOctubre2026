import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestVoiceProvider } from "@/components/game/GuestVoice";
import { MomRoomMinigame } from "@/components/minigames/MomRoomMinigame";
import { CorduraContext, type CorduraLight, type CorduraReporter } from "@/game/cordura";
import { STORY_SLOTS } from "@/game/demoProfile";
import { levelById, STORY_LEVELS } from "@/game/levels/defaultLevels";
import type { MomRoomLevel } from "@/game/levels/types";
import { validateLevel } from "@/game/levels/validate";
import { momCode, pressPanel, withName } from "@/game/momRoom";

const template = levelById("mom_room") as MomRoomLevel;

describe("mom's room rules (Drive D42)", () => {
  it("the code is the marks in the card's order: flower → moon → eye", () => {
    expect(template.momRoom.order).toEqual(["photo", "little_box", "clock"]);
    expect(momCode(template.momRoom)).toEqual(["flower", "moon", "eye"]);
    // the panel's buttons don't give the answer away
    expect(template.momRoom.panel).not.toEqual(momCode(template.momRoom));
  });

  it("a wrong code just clears the panel; the right one opens the drawer", () => {
    const code = momCode(template.momRoom);
    let r = pressPanel([], "flower", code);
    expect(r).toEqual({ input: ["flower"], result: "ok" });
    r = pressPanel(r.input, "eye", code);
    r = pressPanel(r.input, "moon", code);
    expect(r).toEqual({ input: [], result: "wrong" });
    r = pressPanel([], "flower", code);
    r = pressPanel(r.input, "moon", code);
    expect(pressPanel(r.input, "eye", code)).toEqual({ input: [], result: "open" });
  });

  it("puts the player's name in the lines, or 'sweetie' without one", () => {
    expect(withName(template.momRoom.lines.call, "Unai")).toBe("Unai, come here a moment.");
    expect(withName(template.momRoom.lines.leaving, undefined)).toBe("Sweetie… leaving already?");
    expect(withName(template.momRoom.lines.wrong, undefined)).toBe(
      "No, no, sweetie. That's not it.",
    );
  });

  it("D45: no level before mom's room has a line with the child's name", () => {
    const before = STORY_SLOTS.slice(0, STORY_SLOTS.indexOf("task_mom"));
    for (const slot of before)
      expect(JSON.stringify(STORY_LEVELS[slot]), slot).not.toContain("{name}");
    expect(STORY_LEVELS.task_mom.id).toBe("mom_room");
    expect(template.momRoom.lines.call).toContain("{name}");
  });

  it("the level file is valid and the validator catches unsolvable rooms", () => {
    expect(validateLevel(template).ok).toBe(true);
    const broken = (patch: Partial<MomRoomLevel["momRoom"]>) =>
      validateLevel({ ...template, momRoom: { ...template.momRoom, ...patch } });
    expect(broken({ marks: { photo: "moon", little_box: "moon", clock: "eye" } }).ok).toBe(false);
    expect(broken({ order: ["photo", "clock"] }).ok).toBe(false);
    expect(broken({ order: ["photo", "photo", "clock"] }).ok).toBe(false);
    expect(broken({ panel: ["moon", "eye"] }).ok).toBe(false); // can't type the flower
    expect(broken({ panel: ["moon", "eye", "flower", "star"] }).ok).toBe(true); // a decoy is fine
    expect(broken({ door: { x: 120, y: 30 } }).ok).toBe(false);
  });
});

describe("mom's room minigame (UI)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        cancel: vi.fn(),
        getVoices: () => [],
        removeEventListener: vi.fn(),
        speak: vi.fn(),
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function setup() {
    const lights: (CorduraLight | null)[] = [];
    const handlers = new Set<() => void>();
    const reporter: CorduraReporter = {
      light: (l) => {
        lights.push(l);
      },
      fullScare: () => {},
      onEvent100: (h) => {
        handlers.add(h);
        return () => handlers.delete(h);
      },
    };
    const onComplete = vi.fn();
    render(
      <GuestVoiceProvider>
        <CorduraContext.Provider value={reporter}>
          <MomRoomMinigame
            level={template}
            memory={{ playerName: "Unai" }}
            dark
            onComplete={onComplete}
          />
        </CorduraContext.Provider>
      </GuestVoiceProvider>,
    );
    const tap = (name: string | RegExp) =>
      act(() => void fireEvent.click(screen.getByRole("button", { name })));
    const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
    return { lights, handlers, onComplete, tap, wait };
  }

  it("mom's voice calls the name, the room locks, dark marks + lit card → code → key → door", () => {
    const { lights, handlers, onComplete, tap, wait } = setup();

    // the call: the first time the child's name is said, and no Cordura during it
    expect(screen.getByText("“Unai, come here a moment.”")).toBeTruthy();
    expect(lights.at(-1)).toBeNull();
    wait(1600);
    tap("Go to mom's room");
    expect(screen.getByText(/Find a way out/)).toBeTruthy();
    expect(lights.at(-1)).toBe("lit");

    // locked door
    tap("The door");
    expect(screen.getByText("It's locked.")).toBeTruthy();

    // the card only reads with the light on: photo → little box → clock
    tap("A card on the vanity");
    const order = screen.getByRole("list", { name: "The order" });
    expect(order.textContent).toMatch(/Mom's photo.*Little box.*Clock/);
    tap("Put it back");

    // light off: the marks show; the card and the panel can't be used
    expect(screen.getByRole("img", { name: "Mom's photo" })).toBeTruthy();
    tap("Turn the light off");
    expect(lights.at(-1)).toBe("dark");
    expect(screen.getByRole("img", { name: /Mom's photo — a white flower/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Little box — a white moon/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Clock — a white eye/ })).toBeTruthy();
    tap("The drawer's lock panel");
    expect(screen.getByText("It's too dark to see that.")).toBeTruthy();
    expect(screen.queryByText("The drawer is locked.")).toBeNull();

    // light on: a wrong code costs nothing, the right one opens the drawer
    tap("Turn the light on");
    tap("The drawer's lock panel");
    tap("Moon");
    tap("Eye");
    tap("Flower");
    expect(screen.getByText("“No, no, Unai. That's not it.”")).toBeTruthy();
    expect(screen.getByRole("status", { name: "0 of 3 symbols" })).toBeTruthy();
    tap("Flower");
    tap("Moon");
    tap("Eye");
    tap("Take the key");
    expect(screen.getByRole("status", { name: "You have the key" })).toBeTruthy();

    // the 100 event never takes the key away
    tap("Turn the light off");
    act(() => handlers.forEach((h) => h()));
    expect(screen.getByRole("button", { name: "Turn the light off" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "You have the key" })).toBeTruthy();

    // out: the wardrobe opens a crack, mom's voice again — then the task ends
    tap("Unlock the door with the key");
    expect(lights.at(-1)).toBeNull();
    wait(1000);
    expect(screen.getByText("“Unai… leaving already?”")).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    wait(4000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
