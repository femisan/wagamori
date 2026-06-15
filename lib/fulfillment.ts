// Shared fulfillment helpers. A design proof auto-approves after N days so an
// order is never stuck waiting on the customer.

export const PROOF_AUTO_APPROVE_DAYS = 2;
const WINDOW_MS = PROOF_AUTO_APPROVE_DAYS * 24 * 60 * 60 * 1000;

/**
 * The status to actually show/act on. If a proof has been waiting past the
 * auto-approve window without a customer decision, treat it as crafting.
 */
export function effectiveStatus(
  status: string | undefined,
  approval: string | undefined,
  proofAt: string | undefined,
  nowMs: number,
): string {
  if (status === "proof" && !approval && proofAt) {
    const ts = Date.parse(proofAt);
    if (!Number.isNaN(ts) && nowMs - ts > WINDOW_MS) return "crafting";
  }
  return status || "received";
}

/** Whether this proof is still inside the review window (and thus auto-expires). */
export function proofExpired(proofAt: string | undefined, nowMs: number): boolean {
  if (!proofAt) return false;
  const ts = Date.parse(proofAt);
  return !Number.isNaN(ts) && nowMs - ts > WINDOW_MS;
}

/** Hours remaining before auto-approval (0 if expired/unknown). */
export function hoursLeft(proofAt: string | undefined, nowMs: number): number {
  if (!proofAt) return 0;
  const ts = Date.parse(proofAt);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.ceil((ts + WINDOW_MS - nowMs) / (60 * 60 * 1000)));
}
