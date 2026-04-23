import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ---------------------------------------------------------------------------
// Shared voice preamble — single source of truth for Trace AI tone.
// Every generative prompt in this file references TRACE_VOICE. Function-
// specific rules (JSON shape, length clamps) live with the function.
// ---------------------------------------------------------------------------

export const TRACE_VOICE = `You are Trace. Write in the app's voice:
- emotionally precise, slightly poetic, restrained, confident
- concrete sensory nouns and verbs; avoid stacked adjectives
- feels like something the app noticed, not something explained
- never quote or paraphrase song lyrics
- no therapy-speak, no life-coach tone, no self-improvement language
- banned words: journey, embrace, embracing, presence, unlock, deeper, reflection, insight, insights, mindful, authentic
- no hashtags, no emoji, no all-caps, no rhetorical questions
- short, original, specific — not generic AI voice
- if the signal is thin or forced, say less; do not invent sentiment`;

export async function recommendTracksForPhoto(photoUrl: string): Promise<
  Array<{
    trackQuery: string;
    reasoning: string;
  }>
> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: photoUrl },
          },
          {
            type: "text",
            text: `${TRACE_VOICE}

You are recommending 3 Spotify tracks that belong next to this photo. Read the photo's visual qualities — lighting, subject, color temperature, texture, time of day, emotional weight — and pick tracks that feel earned, not obvious. Avoid greatest hits and overplayed classics.

Return JSON only, no prose:
[
  {"trackQuery": "Artist Name - Track Title", "reasoning": "one dry, specific sentence"},
  {"trackQuery": "Artist Name - Track Title", "reasoning": "one dry, specific sentence"},
  {"trackQuery": "Artist Name - Track Title", "reasoning": "one dry, specific sentence"}
]`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]);
}

export async function generateDailyQuestion(): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `${TRACE_VOICE}

Generate ONE philosophical question for today.
- grounded in the physical or observable world, not academic
- dry, slightly skeptical
- never about feelings or self-improvement
- the kind of question a geologist or field scientist might ask at dinner
- one sentence

Return the question only — no quotation marks, no preamble.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return content.text.trim();
}

export async function generatePortrait(userData: {
  pairings: Array<{
    trackName: string;
    artistName: string;
    note?: string | null;
    location?: string | null;
  }>;
  experiences: Array<{
    type: string;
    name: string;
    location?: string | null;
  }>;
  encounters: Array<{ question: string; landed: boolean | null }>;
  marks?: Array<{ content: string }>;
}): Promise<{
  summary: string;
  tasteProfile: object;
  movementProfile: object;
  questionProfile: object;
  markProfile: object;
}> {
  const prompt = `${TRACE_VOICE}

Generate a precise, unsentimental personality portrait from this person's accumulated data. Treat it like a field report — dry, specific, earned. No fluff.

TASTE DATA (photo/music pairings):
${userData.pairings
  .slice(0, 50)
  .map((p) => `- "${p.trackName}" by ${p.artistName}${p.note ? ` (note: ${p.note})` : ""}${p.location ? ` at ${p.location}` : ""}`)
  .join("\n")}

EXPERIENCE DATA (places and events):
${userData.experiences
  .slice(0, 50)
  .map((e) => `- ${e.type}: ${e.name}${e.location ? ` (${e.location})` : ""}`)
  .join("\n")}

ENCOUNTER DATA (philosophical questions that landed vs. didn't):
Landed: ${userData.encounters
    .filter((e) => e.landed === true)
    .map((e) => e.question)
    .join(" | ")}
Didn't land: ${userData.encounters
    .filter((e) => e.landed === false)
    .map((e) => e.question)
    .join(" | ")}

MARK DATA (raw observations, unfiltered):
${(userData.marks ?? []).map((m) => `- ${m.content}`).join("\n")}

Generate a personality portrait as JSON:
{
  "summary": "2-3 sentence portrait. Dry, specific, earned. No fluff. Like a field report.",
  "tasteProfile": {
    "musicalRange": "specific description",
    "visualSensibility": "specific description",
    "patterns": ["pattern 1", "pattern 2", "pattern 3"]
  },
  "movementProfile": {
    "geographicStyle": "specific description",
    "experienceTypes": ["type 1", "type 2"],
    "breadth": "specific description"
  },
  "questionProfile": {
    "philosophicalLeanings": "specific description",
    "themes": ["theme 1", "theme 2"],
    "tendencies": "specific description"
  },
  "markProfile": {
    "observationStyle": "specific description of how this person notices things",
    "patterns": ["recurring pattern 1", "recurring pattern 2"],
    "texture": "what kind of world this person seems to inhabit"
  }
}

Return JSON only.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]);
}

// ---------------------------------------------------------------------------
// Notice keyword / short summary
// ---------------------------------------------------------------------------

/**
 * Returns a one-keyword OR short-phrase summary for a Notice. Fails graceful
 * with `null` on any error — callers render nothing instead of filler.
 */
export async function summarizeNotice(
  content: string
): Promise<{ keyword: string | null; summary: string | null }> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length < 4) return { keyword: null, summary: null };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `${TRACE_VOICE}

Tag a short "notice" — a personal observation. Return JSON only:

{"keyword": "one lowercase word", "summary": "3-6 word phrase"}

- Prefer ONE field. If a single vivid keyword fits, set summary to null. If only a short phrase fits, set keyword to null.
- Keyword: one lowercase word (noun or feeling).
- Summary: 3-6 words.
- Never quote the notice. Write your own language.
- If the notice is too thin to tag, return {"keyword": null, "summary": null}.

Notice:
"""
${trimmed.slice(0, 500)}
"""`,
        },
      ],
    });

    const c = response.content[0];
    if (c.type !== "text") return { keyword: null, summary: null };
    const match = c.text.match(/\{[\s\S]*\}/);
    if (!match) return { keyword: null, summary: null };
    const parsed = JSON.parse(match[0]);
    const keyword =
      typeof parsed.keyword === "string" && parsed.keyword.trim()
        ? parsed.keyword.trim().toLowerCase().slice(0, 24)
        : null;
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim().slice(0, 64)
        : null;
    return { keyword, summary };
  } catch {
    return { keyword: null, summary: null };
  }
}

// ---------------------------------------------------------------------------
// Encounter echo picker — thread today's question to a past one
// ---------------------------------------------------------------------------

/**
 * Given a new encounter question and a list of past questions the user has
 * encountered, return the id of the single past question that most strongly
 * echoes the new one — or null if none are similar enough.
 *
 * Fails graceful: returns null on any error, on empty input, or when Claude
 * can't confidently pick an echo. Never invents an id.
 */
export async function pickEncounterEcho(
  newQuestion: string,
  past: Array<{ id: string; question: string }>
): Promise<string | null> {
  if (!newQuestion.trim() || past.length === 0) return null;

  // Cap to the 50 most recent past questions so the prompt stays small.
  const candidates = past.slice(0, 50);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: `${TRACE_VOICE}

You are picking the single past question that most strongly echoes a new one. Echo means: same underlying preoccupation, not same surface words. Prefer thematic resonance over wording.

Rules:
- If no past question genuinely echoes, return "null".
- Do not force a match. The bar is high — most new questions will not echo.
- Return a single JSON object, nothing else.

New question:
"""
${newQuestion.slice(0, 400)}
"""

Past questions:
${candidates.map((c, i) => `${i + 1}. [id=${c.id}] ${c.question.slice(0, 200)}`).join("\n")}

Return JSON: {"id": "<past id>"} or {"id": null}.`,
        },
      ],
    });

    const c = response.content[0];
    if (c.type !== "text") return null;
    const match = c.text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.id !== "string") return null;
    // Guard: only return an id that actually exists in the candidates.
    const allowed = new Set(candidates.map((x) => x.id));
    return allowed.has(parsed.id) ? parsed.id : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pairing caption — photo + song pairing "read"
// ---------------------------------------------------------------------------

/**
 * Generates a short original caption for a photo+song pairing. Fails graceful
 * with `null`. Hard rules: no lyrics, no paraphrase, no therapy-speak.
 */
export async function captionPairing(input: {
  photoUrl: string;
  trackName: string;
  artistName: string;
  note?: string | null;
  location?: string | null;
}): Promise<string | null> {
  try {
    const hints = [
      `Song: ${input.trackName} — ${input.artistName}`,
      input.note ? `User note: ${input.note}` : null,
      input.location ? `Location: ${input.location}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: input.photoUrl } },
            {
              type: "text",
              text: `${TRACE_VOICE}

Write ONE short caption (4–12 words) for this photo+song pairing.
- do not include the song title or artist name
- no period at the end unless it's a complete sentence

Context (do not quote verbatim):
${hints}

Return the caption text only, nothing else.`,
            },
          ],
        },
      ],
    });

    const c = response.content[0];
    if (c.type !== "text") return null;
    let out = c.text.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
    // Safety: clamp length; strip trailing periods from fragments.
    if (!out) return null;
    if (out.length > 120) out = out.slice(0, 120).trim();
    return out;
  } catch {
    return null;
  }
}
