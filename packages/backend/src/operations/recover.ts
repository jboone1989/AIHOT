// In-doubt work. A stopped process leaves "pending" receipts and deliveries: they become
// "unknown" and are never re-sent on their own. Automatic release without checking the
// provider's bill is disabled by default. A deployment can explicitly opt in to the legacy
// one-time 30-minute release behavior with RECEIPT_AUTO_RELEASE_ENABLED=true. A released
// receipt lets its request call again, and an article that stopped on it goes back to processing.
import { audit, Conflict } from "../audit.ts";
import { sql } from "../db.ts";
import { resumeAfterRelease } from "../jobs/content.ts";
import { sweepUngrouped } from "../jobs/events.ts";
import { retryReleasedReceiptJobs } from "../jobs/queue.ts";
import { markStaleDeliveries } from "../notify/deliver.ts";
import { markStalePendingReceipts, releaseUnknownReceipt } from "../providers/receipts.ts";

const AUTO_RELEASE_AFTER_MS = 30 * 60_000;
export const AUTO_RELEASE_NOTE = "自动放行：结果未知超过 30 分钟，未核对是否计费";

async function release(id: number, error: string, actor: string, note: string, billed: boolean | null) {
  return sql.begin(async (tx) => {
    const receipt = await releaseUnknownReceipt(tx, id, error);
    if (!receipt) return null;
    const requeued = await resumeAfterRelease(receipt, tx);
    await audit(actor, "receipt.release", `receipt:${id}`, note, { status: "unknown" }, { status: "failed", billed, requeued }, { db: tx });
    return { id, status: "failed", subject: receipt.subject, purpose: receipt.purpose, requeued };
  });
}

/** Admin, after checking the provider's console: records whether it was billed and releases it. */
export async function releaseReceipt(id: number, input: { billed: boolean; note: string }, actor: string) {
  if (!input.note?.trim()) throw new Error("note is required");
  const [row] = await sql<{ status: string }[]>`SELECT status FROM receipts WHERE id = ${id}`;
  if (!row) return null;
  if (row.status !== "unknown") throw new Conflict("只有结果未知的回执需要人工核对");
  const error = `人工核对：${input.billed ? "供应商已计费但结果未取回" : "供应商未计费"}。${input.note}`;
  return release(id, error, actor, input.note, input.billed);
}

/**
 * Unknown receipts older than half an hour, released without checking the provider's bill. A request
 * released this way once and unknown again stays for the admin (the alerts' follow-ups list it).
 */
export async function autoReleaseUnknownReceipts(now = Date.now()) {
  const rows = await sql<{ id: number }[]>`
    SELECT r.id FROM receipts r
    WHERE r.status = 'unknown' AND r.updated_at < ${new Date(now - AUTO_RELEASE_AFTER_MS)}
      AND NOT EXISTS (SELECT 1 FROM receipt_attempts a WHERE a.receipt_id = r.id AND a.error LIKE ${AUTO_RELEASE_NOTE + "%"})
    ORDER BY r.id LIMIT 200`;
  let released = 0;
  let requeued = 0;
  for (const r of rows) {
    const done = await release(r.id, AUTO_RELEASE_NOTE, "ops.recover", "结果未知，自动放行一次", null);
    if (done) released += 1;
    if (done?.requeued) requeued += 1;
  }
  return { released, requeued };
}

/** Production requires explicit operator review before another potentially billable call. */
export function autoReleaseConfigured(value: string | undefined): boolean {
  return value === "true";
}

/** ops.recover, every 10 minutes. */
export async function recoverStaleWork() {
  const receipts = await markStalePendingReceipts();
  const released = autoReleaseConfigured(process.env.RECEIPT_AUTO_RELEASE_ENABLED)
    ? await autoReleaseUnknownReceipts()
    : { released: 0, requeued: 0 };
  return { receipts, released, jobs: await retryReleasedReceiptJobs(), grouping: await sweepUngrouped(), deliveries: await markStaleDeliveries() };
}
