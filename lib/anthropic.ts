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

// ---------------------------------------------------------------------------
// Ask Trace — one-shot Q&A grounded in the user's own traces.
// ---------------------------------------------------------------------------

export interface AskTraceContext {
  pairings: Array<{ trackName: string; artistName: string; note?: string | null; location?: string | null; createdAt: Date }>;
  experiences: Array<{ type: string; name: string; location?: string | null; date: Date | null; note?: string | null }>;
  encounters: Array<{ question: string; answer: string | null; landed: boolean | null; date: Date }>;
  marks: Array<{ content: string; createdAt: Date }>;
}

export interface AskTraceAnswer {
  answer: string;
  citations: Array<{ kind: "tracks" | "path" | "notice" | "encounter"; hint: string }>;
}

/**
 * Answer a user's question using their own traces as ground truth. The model
 * is instructed to stay grounded — if the traces don't support an answer, say
 * "not enough signal" rather than invent.
 *
 * Returns citations as short hints (not IDs) so the UI can surface "from your
 * Tracks", "from your Path", etc. without bleeding internal refs.
 */
export async function askTrace(
  question: string,
  ctx: AskTraceContext
): Promise<AskTraceAnswer> {
  const formattedPairings = ctx.pairings
    .slice(0, 40)
    .map((p) => {
      const date = p.createdAt.toISOString().slice(0, 10);
      const parts = [`[${date}] "${p.trackName}" by ${p.artistName}`];
      if (p.location) parts.push(`at ${p.location}`);
      if (p.note) parts.push(`note: ${p.note}`);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n") || "(none)";

  const formattedExperiences = ctx.experiences
    .slice(0, 40)
    .map((e) => {
      const date = e.date ? e.date.toISOString().slice(0, 10) : "undated";
      const parts = [`[${date}] ${e.type}: ${e.name}`];
      if (e.location) parts.push(`in ${e.location}`);
      if (e.note) parts.push(`note: ${e.note}`);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n") || "(none)";

  const formattedEncounters = ctx.encounters
    .slice(0, 30)
    .map((e) => {
      const date = e.date.toISOString().slice(0, 10);
      const a = e.answer ? ` answer: ${e.answer}` : "";
      const verdict = e.landed === true ? " [landed]" : e.landed === false ? " [didn't land]" : "";
      return `- [${date}] Q: ${e.question}${a}${verdict}`;
    })
    .join("\n") || "(none)";

  const formattedMarks = ctx.marks
    .slice(0, 30)
    .map((m) => {
      const date = m.createdAt.toISOString().slice(0, 10);
      return `- [${date}] ${m.content.slice(0, 200)}`;
    })
    .join("\n") || "(none)";

  const prompt = `${TRACE_VOICE}

The user has asked a question about their own traces. Answer using ONLY the data below. If the signal is thin, say so directly — do not invent patterns or speculate.

USER QUESTION:
${question.slice(0, 500)}

THEIR TRACKS (music paired with moments):
${formattedPairings}

THEIR PATH (places logged):
${formattedExperiences}

THEIR ENCOUNTERS (daily questions + answers):
${formattedEncounters}

THEIR NOTICES (short field notes):
${formattedMarks}

Respond in 1-4 sentences. Voice is Trace's — dry, specific, earned. When you reference a trace, name the kind inline ("from your Tracks", "in a Notice from last spring"). No lists, no headers. Return JSON:
{
  "answer": "...",
  "citations": [{"kind": "tracks|path|notice|encounter", "hint": "short reference"}]
}
Max 3 citations. If you can't answer from the data, return {"answer": "Not enough signal yet.", "citations": []}.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const c = response.content[0];
    if (c.type !== "text") {
      return { answer: "Not enough signal yet.", citations: [] };
    }
    const match = c.text.match(/\{[\s\S]*\}/);
    if (!match) return { answer: c.text.trim().slice(0, 500), citations: [] };
    try {
      const parsed = JSON.parse(match[0]) as AskTraceAnswer;
      const answer = typeof parsed.answer === "string" ? parsed.answer.slice(0, 1000) : "Not enough signal yet.";
      const citations = Array.isArray(parsed.citations)
        ? parsed.citations
            .filter((x) => x && typeof x.kind === "string" && typeof x.hint === "string")
            .slice(0, 3)
        : [];
      return { answer, citations };
    } catch {
      return { answer: c.text.trim().slice(0, 500), citations: [] };
    }
  } catch (err) {
    console.error("[askTrace] failed:", err);
    return { answer: "Couldn't reach the model just now. Try again in a moment.", citations: [] };
  }
}

// ---------------------------------------------------------------------------
// Ticket / poster OCR — "Share to Trace".
// Given an image URL (ticket stub, concert poster, event flyer), extract the
// fields needed to prefill a Path save: venue, city, date, headliner, type.
// Returns nulls on any failure; the user can always hand-edit.
// ---------------------------------------------------------------------------

export interface TicketRead {
  venue: string | null;
  city: string | null;
  date: string | null; // ISO-ish YYYY-MM-DD when legible
  headliner: string | null;
  type: "Concert" | "Stadium" | "Landmark" | "Restaurant" | "Other" | null;
  confidence: "high" | "medium" | "low";
}

export async function readTicket(imageUrl: string): Promise<TicketRead> {
  const empty: TicketRead = {
    venue: null,
    city: null,
    date: null,
    headliner: null,
    type: null,
    confidence: "low",
  };
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            {
              type: "text",
              text: `You are reading a ticket stub, concert poster, or event flyer.
Extract only fields that appear on the image. Do not invent details.

Return JSON only, matching this shape exactly:
{
  "venue": string or null,
  "city": string or null,
  "date": "YYYY-MM-DD" or null,
  "headliner": string or null,
  "type": "Concert" | "Stadium" | "Landmark" | "Restaurant" | "Other" | null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- "type" should be "Concert" for music events, "Stadium" for sports, "Restaurant" for dining, "Landmark" for attractions. Otherwise "Other".
- "date" must be YYYY-MM-DD or null. If only month+day visible and the year is unclear, return null.
- If the image isn't a ticket/poster, return all nulls and confidence "low".
- Do not include any text outside the JSON object.`,
            },
          ],
        },
      ],
    });
    const c = response.content[0];
    if (c.type !== "text") return empty;
    const match = c.text.match(/\{[\s\S]*\}/);
    if (!match) return empty;
    const parsed = JSON.parse(match[0]) as TicketRead;
    return {
      venue: typeof parsed.venue === "string" ? parsed.venue : null,
      city: typeof parsed.city === "string" ? parsed.city : null,
      date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
      headliner: typeof parsed.headliner === "string" ? parsed.headliner : null,
      type:
        parsed.type === "Concert" ||
        parsed.type === "Stadium" ||
        parsed.type === "Landmark" ||
        parsed.type === "Restaurant" ||
        parsed.type === "Other"
          ? parsed.type
          : null,
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
          ? parsed.confidence
          : "low",
    };
  } catch {
    return empty;
  }
}
