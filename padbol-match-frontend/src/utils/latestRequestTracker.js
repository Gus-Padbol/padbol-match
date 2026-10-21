/** Prevent an earlier response from overwriting a newer request or session. */
export function createLatestRequestTracker() {
  let sequence = 0;
  return {
    begin() { sequence += 1; return sequence; },
    isCurrent(id) { return id === sequence; },
    invalidate() { sequence += 1; },
  };
}
