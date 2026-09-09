// src/lib/aiModels.ts
//
// Free-plan users always get DEFAULT_MODEL. Purple users can pick any of
// PRO_MODELS in Settings → Subscription; the choice is stored on
// profiles.ai_model (see the matching migration) and read back in
// ai.functions.ts. Keep this list in sync with what's actually available
// on OpenRouter — a delisted/renamed model shows up as a 404 from the
// gateway, which resolveModel() below can't detect ahead of time.

export const DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning:free";

export type SonaModelId =
  | "thinkingmachines/inkling:free"
  | "inclusionai/ling-3.0-flash-sante:free"
  | "nex-agi/nex-n2.5-pro:free"
  | "nex-agi/nex-n2.5-mini:free";

export const PRO_MODELS: { id: SonaModelId; label: string; blurb: string }[] = [
  { id: "thinkingmachines/inkling:free", label: "Inkling", blurb: "Thinking Machines' general-purpose model." },
  { id: "inclusionai/ling-3.0-flash-sante:free", label: "Ling 3.0 Flash", blurb: "Fast, lightweight everyday replies." },
  { id: "nex-agi/nex-n2.5-pro:free", label: "Nex N2.5 Pro", blurb: "Stronger reasoning for longer, trickier asks." },
  { id: "nex-agi/nex-n2.5-mini:free", label: "Nex N2.5 Mini", blurb: "Nex's quick, snappy small model." },
];

const PRO_MODEL_IDS = new Set<string>(PRO_MODELS.map((m) => m.id));

/** Fallback chain tried in order when the caller's chosen model fails. */
export function fallbackChain(preferred: string): string[] {
  const chain = [preferred, ...PRO_MODELS.map((m) => m.id), DEFAULT_MODEL];
  return Array.from(new Set(chain));
}

/** A free user (or a Purple user with no/invalid pick) always gets DEFAULT_MODEL. */
export function resolveModel(isPro: boolean, requested?: string | null): string {
  if (isPro && requested && PRO_MODEL_IDS.has(requested)) return requested;
  return DEFAULT_MODEL;
}

export function isProModelId(id: string | null | undefined): id is SonaModelId {
  return !!id && PRO_MODEL_IDS.has(id);
}
