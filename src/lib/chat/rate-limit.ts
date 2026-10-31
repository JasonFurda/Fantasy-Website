import "server-only";

// Best-effort abuse brake for a public endpoint that costs money per call. State
// lives in this server instance's memory, so limits reset on a cold start and
// aren't shared between instances. The hard ceiling is the spend limit set on the
// Anthropic account.

const HOUR_MS = 60 * 60 * 1000;
const PER_VISITOR_PER_HOUR = 20;
const PER_INSTANCE_PER_DAY = 500;
const MAX_TRACKED_VISITORS = 5000;

const visitors = new Map<string, number[]>();
let dayStart = 0;
let dayCount = 0;

/** Records the request and returns true when it's allowed. */
export function allowChatRequest(visitor: string, now = Date.now()): boolean {
  if (now - dayStart >= 24 * HOUR_MS) {
    dayStart = now;
    dayCount = 0;
  }
  if (dayCount >= PER_INSTANCE_PER_DAY) return false;

  const recent = (visitors.get(visitor) ?? []).filter(
    (t) => now - t < HOUR_MS,
  );
  if (recent.length >= PER_VISITOR_PER_HOUR) return false;

  if (visitors.size >= MAX_TRACKED_VISITORS) visitors.clear();
  recent.push(now);
  visitors.set(visitor, recent);
  dayCount++;
  return true;
}
