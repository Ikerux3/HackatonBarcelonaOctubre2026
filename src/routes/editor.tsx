import { createFileRoute } from "@tanstack/react-router";

import { LevelEditor } from "@/components/editor/LevelEditor";

// Developer-only level editor. Not linked from the player-facing game.
export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Level Editor — Mommy Will Be Back (dev)" },
      {
        name: "description",
        content: "Developer tool for authoring Mommy Will Be Back minigame levels.",
      },
      { property: "og:title", content: "Level Editor — Mommy Will Be Back (dev)" },
      {
        property: "og:description",
        content: "Developer tool for authoring Mommy Will Be Back minigame levels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LevelEditor,
});
