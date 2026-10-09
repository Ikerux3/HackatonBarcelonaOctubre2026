// Local-only name validation. Anything doubtful becomes "sweetie".
const BLOCKLIST = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "ass", "nigg", "fag", "whore", "slut",
  "puta", "puto", "mierda", "joder", "polla", "coño", "cabron", "cabrón", "gilipollas", "maricon",
  "merda", "collons", "hitler", "nazi", "sex", "porn", "kill", "die",
];
export const DEFAULT_NAME = "sweetie";

export function sanitizeName(input: string): string {
  const name = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 16) return DEFAULT_NAME;
  if (!/^[\p{L} ]+$/u.test(name)) return DEFAULT_NAME;
  const flat = name.toLowerCase().replace(/\s/g, "");
  if (BLOCKLIST.some((w) => flat.includes(w))) return DEFAULT_NAME;
  // Capitalize each word for display
  return name
    .split(" ")
    .map((w) => w.charAt(0).toLocaleUpperCase() + w.slice(1))
    .join(" ");
}
