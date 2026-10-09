import type { AIAdapter, AIRequest, AIResponse, NormalizedColor, ToyCategory } from "./contracts";

// Deterministic mock adapter. Stands in for the real AI interpretation
// service being built by another developer. Never blocks the game:
// it resolves after a short simulated latency and always returns a
// valid structured response.

const COLOR_KEYWORDS: Array<[NormalizedColor, string[]]> = [
  ["red", ["red", "rojo", "roja", "scarlet", "crimson", "burgundy"]],
  ["blue", ["blue", "azul", "navy", "cyan", "turquoise", "celeste"]],
  ["yellow", ["yellow", "amarillo", "amarilla", "gold", "golden", "dorado"]],
  ["green", ["green", "verde", "lime", "emerald", "mint"]],
  ["purple", ["purple", "morado", "morada", "violet", "violeta", "lila", "lavender"]],
  ["pink", ["pink", "rosa", "rosado", "magenta", "fuchsia"]],
  ["orange", ["orange", "naranja", "anaranjado", "peach", "coral"]],
];

const TOY_KEYWORDS: Array<[ToyCategory, string[]]> = [
  ["doll", ["doll", "muñeca", "muneca", "barbie", "dolly"]],
  ["teddy", ["teddy", "oso", "osito", "bear", "peluche", "plush", "stuffed"]],
  ["dinosaur", ["dino", "dinosaur", "dinosaurio", "t-rex", "trex", "rex"]],
  ["car", ["car", "coche", "carro", "auto", "truck", "camion", "vehicle"]],
  ["robot", ["robot", "android", "androide", "transformer"]],
  ["ball", ["ball", "pelota", "balon", "balón", "football", "soccer"]],
];

function normalizeColor(answer: string): { color: NormalizedColor; matched: boolean } {
  const text = answer.toLowerCase();
  for (const [color, words] of COLOR_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return { color, matched: true };
  }
  return { color: "other", matched: false };
}

function normalizeToy(answer: string): { toy: ToyCategory; matched: boolean } {
  const text = answer.toLowerCase();
  for (const [toy, words] of TOY_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return { toy, matched: true };
  }
  return { toy: "other", matched: false };
}

const COLOR_LINES: Record<NormalizedColor, string> = {
  red: "Red… like the little light under the door. I remember red.",
  blue: "Blue… the color of the house when the lights go out. How fitting.",
  yellow: "Yellow… like the lamp that just stopped working. Funny, isn't it?",
  green: "Green… like eyes in the dark. Like mine.",
  purple: "Purple… the color of bruises on the evening sky. Lovely choice.",
  pink: "Pink… so soft. Soft things are easy to take.",
  orange: "Orange… like the sunset your mother is walking under. Far away.",
  other: "Hm. I don't know that color. I'll just… take one for you.",
};

const TOY_LINES: Record<ToyCategory, string> = {
  doll: "A doll… I saw one upstairs. Its eyes were open. They weren't before.",
  teddy: "A teddy bear… it keeps you safe, doesn't it? It's under the bed now. Check.",
  dinosaur: "A dinosaur… something bigger than you that could swallow you whole. I understand.",
  car: "A little car… vroom, vroom. Cars take people away. Like the one your mother took.",
  robot: "A robot… no feelings, no fear. You wish you were one right now, don't you?",
  ball: "A ball… it rolled into the dark corner earlier. Did you hear it stop?",
  other: "I know that toy. It's in this house. It misses you too.",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockAdapter: AIAdapter = {
  async interpretAnswer(request: AIRequest): Promise<AIResponse> {
    // Simulated network latency so the loading state is visible.
    await delay(700);

    if (request.questionType === "favorite_color") {
      const { color, matched } = normalizeColor(request.answer);
      return {
        questionType: "favorite_color",
        normalizedColor: color,
        monsterLine: COLOR_LINES[color],
        ...(color !== "other" ? { displayAnswer: color } : {}),
        puzzleVariant: "color_removed",
        fallbackUsed: !matched,
      };
    }

    const { toy, matched } = normalizeToy(request.answer);
    return {
      questionType: "favorite_toy",
      normalizedToy: toy,
      monsterLine: TOY_LINES[toy],
      ...(toy !== "other" ? { displayAnswer: `your ${toy}` } : {}),
      puzzleVariant: "toy_shadow",
      fallbackUsed: !matched,
    };
  },
};
