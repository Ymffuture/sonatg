# SonaTG — "Ask Sona" Message Intelligence

Files for the Message Intelligence feature, based on `Ymffuture/sonatg` (main).

## New files (drop in as-is)
- `src/lib/messageIntelligence.functions.ts` — the `askSonaAboutMessage` server fn
  (auth, membership/block checks, action prompts, bounded context, gateway call).
- `src/components/AskSonaPanel.tsx` — the "Ask Sona" bottom-sheet UI.

## Modified files (full file included + a `.diff.patch` per file)
- `src/lib/ai.functions.ts` — only exported `callGateway` and `describeForHistory`
  so the new server fn can reuse them. No behavior change.
- `src/components/MessageBubble.tsx` — added `isAskSonaEligible()`, an "Ask Sona"
  item in the existing long-press/right-click context menu, and threaded an
  `onAskSona` prop through `Bubble`.
- `src/components/SonaChat.tsx` — added `askSonaMessage` state, wired
  `onAskSona` on the `<Bubble>` render, and rendered `<AskSonaPanel>` next to
  the existing `<ForwardModal>` renders.

## Applying the patches
From the repo root:
```bash
git apply MessageBubble.diff.patch
git apply SonaChat.diff.patch
git apply ai.functions.diff.patch
```
Then copy the two new files into place under `src/lib/` and `src/components/`.

## Verified
- `tsc --noEmit`: no new errors vs. a clean clone of `main` (the only errors
  present are a pre-existing `profiles`/`ai_model` generated-types mismatch
  that already exists in unmodified `ai.functions.ts`).
- `eslint --fix` on both new files: clean, only prettier whitespace was
  auto-fixed.
- Not run: a live `npm run dev` smoke test (needs your `OPENROUTER_API_KEY`,
  `SUPABASE_URL`, etc.) — recommend a quick manual pass, especially on the
  `blocks` RLS check.
