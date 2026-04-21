import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
            text: `You are a music curator with an acute visual sensibility. Given this photo's visual qualities — lighting, subject, mood, color temperature, texture, time of day, emotional weight — recommend 3 Spotify tracks that belong next to it.

Return JSON only, no prose:
[
  {"trackQuery": "Artist Name - Track Title", "reasoning": "one sentence, dry and specific"},
  {"trackQuery": "Artist Name - Track Title", "reasoning": "one sentence, dry and specific"},
  {"trackQuery": "Artist Name - Track Title", "reasoning": "one sentence, dry and specific"}
]

The tracks should feel earned, not obvious. Avoid greatest hits and overplayed classics.`,
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
        content: `Generate one philosophical question for today. Rules:
- Philosophically grounded but not academic
- Rooted in the physical or observable world
- Dry and slightly skeptical in tone
- Never about feelings, emotions, or self-improvement
- One sentence only
- Not precious or inspirational
- The kind of question a geologist or field scientist might ask at dinner

Return the question only, no quotation marks, no preamble.`,
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
  const prompt = `You are Atlas, a personality portrait system. Based on this person's accumulated data, generate a precise, unsentimental personality portrait.

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
