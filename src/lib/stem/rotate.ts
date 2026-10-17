// src/lib/stem/rotate.ts
//
// Automatic model switching for the agents. An agent run makes 3-6 model calls in a row, so one
// dead or overloaded model must not cost a long timeout every time:
//   · each call walks the chain (the user's default model first, then the others);
//   · a model that fails is remembered ("cooldown") and skipped by later calls, so only the FIRST
//     call pays for discovering that it's down;
//   · if every model is cooling down we still try them (better a retry than a guaranteed failure).
// Pure and dependency-injected so it can be tested without network.

/** model id -> epoch ms until which it is skipped */
export type ModelHealth = Map<string, number>;

/** How long to avoid a model after this error. 0 = don't blame the model. */
export function cooldownFor(err: Error): number {
  const m = err.message;
  if (/credits exhausted/i.test(m)) return 0; // key-level problem, identical on every model
  if (/isn't available/i.test(m)) return 30 * 60_000; // delisted / no endpoint
  if (/busy right now/i.test(m)) return 60_000; // rate limited
  return 3 * 60_000; // timeout, empty reply, 5xx, network
}

export async function callWithRotation(o: {
  chain: string[];
  health: ModelHealth;
  callOnce: (model: string) => Promise<string>;
  maxAttempts?: number;
  now?: () => number;
  onSwitch?: (model: string, err: Error) => void;
}): Promise<string> {
  const now = (o.now ?? Date.now)();
  const healthy = o.chain.filter((m) => (o.health.get(m) ?? 0) <= now);
  const order = (healthy.length ? healthy : o.chain).slice(0, o.maxAttempts ?? 4);
  let last: Error | null = null;
  for (const model of order) {
    try {
      const out = await o.callOnce(model);
      o.health.delete(model);
      return out;
    } catch (e) {
      last = e as Error;
      const ms = cooldownFor(last);
      if (ms > 0) o.health.set(model, now + ms);
      o.onSwitch?.(model, last);
      if (/credits exhausted/i.test(last.message)) break;
    }
  }
  throw last ?? new Error("Sona AI is unavailable right now.");
}
