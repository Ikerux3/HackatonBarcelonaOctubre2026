import { createFileRoute } from "@tanstack/react-router";

import { GameScreen } from "@/components/game/GameScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mommy Will Be Back — a short horror puzzle game" },
      {
        name: "description",
        content:
          "A mobile-first psychological horror puzzle game. Tidy your toys, set the table, and answer the thing in the dark — it remembers what you tell it.",
      },
      { property: "og:title", content: "Mommy Will Be Back — a short horror puzzle game" },
      {
        property: "og:description",
        content:
          "A mobile-first psychological horror puzzle game. Tidy your toys, set the table, and answer the thing in the dark — it remembers what you tell it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GameScreen,
});
