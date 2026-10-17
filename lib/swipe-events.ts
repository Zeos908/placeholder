/**
 * Tells a post's card that its swipe was undone, so a fly-off still in progress is cancelled
 * (and the card springs back) instead of removing the restored post when it finishes.
 */
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function onSwipeUndone(listingId: string, fn: Listener) {
  const set = listeners.get(listingId) ?? new Set<Listener>();
  set.add(fn);
  listeners.set(listingId, set);
  return () => {
    set.delete(fn);
    if (!set.size) listeners.delete(listingId);
  };
}

export function emitSwipeUndone(listingId: string) {
  listeners.get(listingId)?.forEach((fn) => fn());
}
