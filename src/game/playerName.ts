// Local-only name validation. Anything doubtful becomes "sweetie".
// Substring matches (unambiguous) vs whole-word matches (short words that hide inside real names).
const SUBSTRINGS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "pussy",
  "nigg",
  "whore",
  "slut",
  "mierda",
  "joder",
  "gilipollas",
  "maricon",
  "maricón",
  "cabron",
  "cabrón",
  "hitler",
  "porn",
  "collons",
];
const WORDS = [
  "ass",
  "dick",
  "cock",
  "fag",
  "sex",
  "puta",
  "puto",
  "polla",
  "coño",
  "merda",
  "nazi",
  "kill",
];
export const DEFAULT_NAME = "sweetie";

export function sanitizeName(input: string): string {
  const name = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 16) return DEFAULT_NAME;
  if (!/^[\p{L} ]+$/u.test(name)) return DEFAULT_NAME;
  const lower = name.toLowerCase();
  const flat = lower.replace(/\s/g, "");
  if (SUBSTRINGS.some((w) => flat.includes(w))) return DEFAULT_NAME;
  if (lower.split(" ").some((w) => WORDS.includes(w))) return DEFAULT_NAME;
  // Capitalize each word for display
  return name
    .split(" ")
    .map((w) => w.charAt(0).toLocaleUpperCase() + w.slice(1))
    .join(" ");
}
