import type {
  AIAdapter,
  AIRequest,
  AIResponse,
  FoodCategory,
  NormalizedColor,
  ToyCategory,
} from "./contracts";

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

const FOOD_KEYWORDS: Array<[FoodCategory, string[]]> = [
  ["pizza", ["pizza"]],
  [
    "pasta",
    [
      "pasta",
      "spaghetti",
      "espagueti",
      "macarron",
      "macarrón",
      "lasagna",
      "lasaña",
      "noodle",
      "fideo",
    ],
  ],
  ["burger", ["burger", "hamburguesa", "hamburger"]],
  ["soup", ["soup", "sopa", "caldo", "stew", "guiso"]],
  ["cake", ["cake", "pastel", "tarta", "cookie", "galleta", "chocolate", "cupcake", "brownie"]],
  ["ice_cream", ["ice cream", "helado", "gelato"]],
  [
    "fruit",
    [
      "fruit",
      "fruta",
      "apple",
      "manzana",
      "banana",
      "plátano",
      "platano",
      "strawberr",
      "fresa",
      "orange",
      "naranja",
    ],
  ],
  ["chicken", ["chicken", "pollo", "nugget"]],
  ["fish", ["fish", "pescado", "salmon", "salmón", "tuna", "atún", "atun"]],
  ["sushi", ["sushi", "maki"]],
  ["cheese", ["cheese", "queso"]],
  ["salad", ["salad", "ensalada"]],
];

function normalizeFood(answer: string): { food: FoodCategory; matched: boolean } {
  const text = answer.toLowerCase();
  for (const [food, words] of FOOD_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return { food, matched: true };
  }
  return { food: "other", matched: false };
}

const FOOD_LINES: Record<FoodCategory, string> = {
  pizza: "Pizza… warm and round. I set a slice for you. Don't let it get cold.",
  pasta: "Pasta. Long and tangled. Like the hair in the drain.",
  burger: "A burger… I made it just the way you like it. I watched you eat before.",
  soup: "Soup. Hot, so hot. Blow on it… slowly.",
  cake: "Something sweet. Every good child deserves a treat. Are you good?",
  ice_cream: "Ice cream… cold, like my hands. It's melting already.",
  fruit: "Fruit. So healthy. Mommy would be proud. I'm proud.",
  chicken: "Chicken… bones and all. I'll save the bones.",
  fish: "Fish. They stare even after… you know.",
  sushi: "Sushi. Raw. I like things raw too.",
  cheese: "Cheese… the mice will come. I'll keep them away. For now.",
  salad: "Salad. Green and crunchy. Crunch, crunch.",
  other: "I'll cook something for you anyway. You'll eat it.",
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

    if (request.questionType === "favorite_food") {
      const { food, matched } = normalizeFood(request.answer);
      return {
        questionType: "favorite_food",
        normalizedFood: food,
        monsterLine: FOOD_LINES[food],
        ...(food !== "other" ? { displayAnswer: food.replace("_", " ") } : {}),
        puzzleVariant: "food_shown",
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
