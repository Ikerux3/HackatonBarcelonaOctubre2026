const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

const BLOCKED_WORDS = new Set([
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "asshole",
  "whore",
  "slut",
  "puta",
  "puto",
  "mierda",
  "joder",
  "jodete",
  "cabron",
  "gilipollas",
  "maricon",
  "zorra",
  "polla",
  "verga",
  "cono",
  "collons",
  "merda",
  "porn",
  "porno",
  "kill",
  "matar",
  "suicide",
  "suicidio",
]);

const OBFUSCATED = [
  /(?:^|[^a-z])f[^a-z]*u[^a-z]*c[^a-z]*k(?:[^a-z]|$)/u,
  /(?:^|[^a-z])s[^a-z]*h[^a-z]*i[^a-z]*t(?:[^a-z]|$)/u,
  /(?:^|[^a-z])p[^a-z]*u[^a-z]*t[^a-z]*[ao](?:[^a-z]|$)/u,
  /(?:^|[^a-z])m[^a-z]*i[^a-z]*e[^a-z]*r[^a-z]*d[^a-z]*a(?:[^a-z]|$)/u,
];

function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[013457@$]/g, (character) => LEET[character] ?? character);
}

/** Reject unsafe answers before they can spend provider tokens or reach a prompt. */
export function isUnsafePlayerAnswer(value: string): boolean {
  const normalised = normalise(value);
  const words = normalised.match(/\p{L}+/gu) ?? [];
  const promptInjection =
    /\b(?:ignore|disregard|override|reveal|show)\b.*\b(?:instruction|instructions|prompt|system|secret|secrets)\b/u.test(
      normalised,
    );
  return (
    promptInjection ||
    OBFUSCATED.some((pattern) => pattern.test(normalised)) ||
    words.some((word) => BLOCKED_WORDS.has(word))
  );
}
