import { GoogleGenAI } from "@google/genai";
import {
  mediationAnalysisSchema,
  type MediationAnalysis,
} from "./ai-schema.js";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "WARNING: GEMINI_API_KEY is not configured. AI analysis will be unavailable.",
  );
}

const ai = apiKey
  ? new GoogleGenAI({ apiKey })
  : null;

const MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";

type Statement = {
  id: string;
  party: "A" | "B";
  content: string;
};

export function validateMediationAnalysis(
  parsed: unknown,
  statements: Statement[],
): MediationAnalysis {
  const result = mediationAnalysisSchema.safeParse(parsed);
  if (!result.success) throw new Error("Gemini returned JSON that does not match the mediation analysis schema.");
  const analysis = result.data;
  if (/\b(guilty|winner|at fault|fault lies|settlement is|must accept|punishment|penalty|sanction|must pay|must do)\b/i.test(JSON.stringify(analysis))) {
    throw new Error("Gemini output contains prohibited decision language.");
  }
  const statementMap = new Map(statements.map((statement) => [statement.id, statement]));
  for (const fact of [...analysis.agreedFacts, ...analysis.disputedFacts]) {
    for (const source of fact.sources) {
      const statement = statementMap.get(source.statementId);
      if (!statement) throw new Error(`Gemini referenced unknown statement ID: ${source.statementId}`);
      if (statement.party !== source.party) throw new Error(`Gemini assigned the wrong party to statement ${source.statementId}.`);
      const excerpt = source.excerpt.replace(/\s+/g, " ").trim().toLocaleLowerCase();
      const statementText = statement.content.replace(/\s+/g, " ").toLocaleLowerCase();
      if (!excerpt || !statementText.includes(excerpt)) throw new Error(`Gemini supplied an excerpt not found in statement ${source.statementId}.`);
    }
  }
  return analysis;
}

export async function analyzeMediation(
  title: string,
  description: string,
  statements: Statement[],
): Promise<MediationAnalysis> {
  const partyA = statements.find((s) => s.party === "A");
  const partyB = statements.find((s) => s.party === "B");

  if (!partyA || !partyB) {
    throw new Error(
      "Both Party A and Party B statements are required.",
    );
  }

  // This fixture is strictly for the isolated verification process; normal
  // application startup never enables it and never displays generated demo data.
  if (process.env.NODE_ENV === "test" && process.env.MEDIATION_TEST_AI === "1") {
    return validateMediationAnalysis({
      agreedFacts: [],
      disputedFacts: [{ issue: title, partyA: partyA.content, partyB: partyB.content, sources: [
        { party: "A", statementId: partyA.id, excerpt: partyA.content.slice(0, 180) },
        { party: "B", statementId: partyB.id, excerpt: partyB.content.slice(0, 180) },
      ] }],
      unknownFacts: [{ issue: `Evidence needed for ${title}`, whyUnknown: "The two statements alone do not independently establish the events.", neededEvidence: "Relevant records, witnesses, or a shared log." }],
    }, statements);
  }
  if (!ai) throw new Error("Gemini API key is not configured.");

  const prompt = `
You are the evidence-structuring component of THE MEDIATION PROTOCOL.

The application exists to help communities resolve disputes when formal
institutions may be unavailable.

Your role is strictly limited.

YOU MAY:
- identify claims made by each party
- identify claims both parties appear to agree on
- identify claims that conflict
- identify facts that cannot currently be established
- identify what evidence would be needed to establish an unknown fact
- quote short excerpts from the statements as source references

YOU MUST NOT:
- decide who is right
- decide who is at fault
- declare a winner
- invent facts
- assume that either party is truthful
- resolve contradictions yourself
- provide legal judgments
- recommend a settlement

The HUMAN MEDIATOR makes decisions.

Every agreed or disputed fact MUST contain source references using the
exact statement IDs supplied below.

Dispute title:
${title}

Dispute description:
${description}

PARTY A
Statement ID: ${partyA.id}
Statement:
${partyA.content}

PARTY B
Statement ID: ${partyB.id}
Statement:
${partyB.content}

Return ONLY valid JSON matching this structure:

{
  "agreedFacts": [
    {
      "claim": "string",
      "sources": [
        {
          "party": "A",
          "statementId": "exact statement ID",
          "excerpt": "short supporting excerpt"
        }
      ]
    }
  ],
  "disputedFacts": [
    {
      "issue": "string",
      "partyA": "what Party A claims",
      "partyB": "what Party B claims",
      "sources": [
        {
          "party": "A",
          "statementId": "exact statement ID",
          "excerpt": "short excerpt"
        },
        {
          "party": "B",
          "statementId": "exact statement ID",
          "excerpt": "short excerpt"
        }
      ]
    }
  ],
  "unknownFacts": [
    {
      "issue": "string",
      "whyUnknown": "why the available statements cannot establish this",
      "neededEvidence": "what evidence could help establish it"
    }
  ]
}

Important:
Use the actual statement IDs exactly as supplied.
Do not create fake IDs.
Do not add information that does not appear in the statements.
`;

  try {
    console.log(`Calling Gemini model: ${MODEL}`);

    const interaction = await ai.interactions.create({
  model: MODEL,
  input: prompt,

  response_format: {
    type: "text",
    mime_type: "application/json",
    schema: {
      type: "object",
      properties: {
        agreedFacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              claim: {
                type: "string",
              },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    party: {
                      type: "string",
                      enum: ["A", "B"],
                    },
                    statementId: {
                      type: "string",
                    },
                    excerpt: {
                      type: "string",
                    },
                  },
                  required: [
                    "party",
                    "statementId",
                    "excerpt",
                  ],
                },
              },
            },
            required: [
              "claim",
              "sources",
            ],
          },
        },

        disputedFacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              issue: {
                type: "string",
              },
              partyA: {
                type: "string",
              },
              partyB: {
                type: "string",
              },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    party: {
                      type: "string",
                      enum: ["A", "B"],
                    },
                    statementId: {
                      type: "string",
                    },
                    excerpt: {
                      type: "string",
                    },
                  },
                  required: [
                    "party",
                    "statementId",
                    "excerpt",
                  ],
                },
              },
            },
            required: [
              "issue",
              "partyA",
              "partyB",
              "sources",
            ],
          },
        },

        unknownFacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              issue: {
                type: "string",
              },
              whyUnknown: {
                type: "string",
              },
              neededEvidence: {
                type: "string",
              },
            },
            required: [
              "issue",
              "whyUnknown",
              "neededEvidence",
            ],
          },
        },
      },

      required: [
        "agreedFacts",
        "disputedFacts",
        "unknownFacts",
      ],
    },
  },
});

    const text = interaction.output_text;

if (!text) {
  throw new Error("Gemini returned an empty response.");
}

console.log("Gemini raw response received.");

let parsed: unknown;

try {
  parsed = JSON.parse(text);
} catch {
  console.error("RAW GEMINI OUTPUT:");
  console.error(text);

  throw new Error(
    "Gemini returned invalid JSON.",
  );
}

    return validateMediationAnalysis(parsed, statements);
  } catch (error) {
    console.error("Gemini analysis failed:", error);

    throw error instanceof Error
      ? error
      : new Error("Gemini analysis failed.");
  }
}
