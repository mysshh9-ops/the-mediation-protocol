import { z } from "zod";

export const sourceSchema = z.object({
  party: z.enum(["A", "B"]),
  statementId: z.string(),
  excerpt: z.string(),
});

export const factSchema = z.object({
  claim: z.string(),
  sources: z.array(sourceSchema).min(1),
});

export const disputedFactSchema = z.object({
  issue: z.string(),
  partyA: z.string(),
  partyB: z.string(),
  sources: z.array(sourceSchema).min(1),
});

export const unknownFactSchema = z.object({
  issue: z.string(),
  whyUnknown: z.string(),
  neededEvidence: z.string(),
});

export const mediationAnalysisSchema = z.object({
  agreedFacts: z.array(factSchema),
  disputedFacts: z.array(disputedFactSchema),
  unknownFacts: z.array(unknownFactSchema),
});

export type MediationAnalysis = z.infer<
  typeof mediationAnalysisSchema
>;