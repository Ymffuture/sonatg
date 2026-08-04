// A single shared stack that both "an open chat" and "an open modal" push
// onto, so the device/browser back button (and any programmatic
// history.back() call) only ever resolves the TOPMOST layer.
//
// Why this exists: SonaChat's chat view and ChatModals' modals used to run
// two completely independent push/pop + popstate-listener systems. Since
// popstate is a single global browser event, closing a modal (which calls
// history.back() to clean up its own entry) also fired the chat view's
// listener — incorrectly closing the chat underneath it too. Unifying
// them onto one stack means a layer only ever pops itself.

type Layer = { id: symbol; onPop: () => void };

let stack: Layer[] = [];
let historyPushed = false;

function handlePopState() {
  const top = stack[stack.length - 1];
  if (top) {
    historyPushed = false;
    stack.pop();
    top.onPop();
  }
}

if (typeof window !== "undefined" && !(window as unknown as { __sonaBackStackBound?: boolean }).__sonaBackStackBound) {
  window.addEventListener("popstate", handlePopState);
  (window as unknown as { __sonaBackStackBound?: boolean }).__sonaBackStackBound = true;
}

// Pushes a new layer (chat view opening, modal opening, etc). Only the
// 0->1 transition actually touches browser history — nested layers (e.g.
// a modal opened while a chat is already open) share the same single
// history entry, so closing the inner one never touches the outer one's
// state at all.
export function pushBackLayer(onPop: () => void): () => void {
  const id = Symbol();
  stack.push({ id, onPop });
  if (stack.length === 1 && !historyPushed) {
    window.history.pushState({ sonaLayer: true }, "");
    historyPushed = true;
  }

  // Returned function pops this specific layer when called by whatever
  // closed it programmatically (X button, selecting a friend, etc.) —
  // deferred by a microtask so a layer that gets swapped back in
  // synchronously (e.g. Member List -> Group Settings) doesn't race with
  // the history.back() the same way the old per-modal stack used to.
  return function popLayer() {
    const idx = stack.findIndex((l) => l.id === id);
    if (idx !== -1) stack.splice(idx, 1);
    queueMicrotask(() => {
      if (stack.length === 0 && historyPushed) {
        historyPushed = false;
        window.history.back();
      }
    });
  };
}
