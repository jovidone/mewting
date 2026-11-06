/** Per-session token bucket, also used before rejecting invalid payloads. */
export class RateLimit {
  private tokens: number;
  private updated: number;
  constructor(private readonly capacity: number, private readonly perSecond: number, now = performance.now()) {
    this.tokens = capacity;
    this.updated = now;
  }
  take(now = performance.now()): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0, now - this.updated) * this.perSecond / 1000);
    this.updated = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
