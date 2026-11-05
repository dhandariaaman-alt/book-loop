// One report with the reported content inline and the moderation actions.
// Used by the admin reports queue and the moderator dashboard.

import Link from "next/link";
import { adminReportAction } from "@/app/actions/admin";
import { moderatorReportAction } from "@/app/actions/moderation";
import { fmtDateTime, humanize, type ReportRow } from "@/lib/admin";
import { ActionForm } from "./action-form";
import { Badge, SelectField, UserLink } from "./kit";

export function ReportCard({ r, mode }: { r: ReportRow; mode: "admin" | "moderator" }) {
  const action = mode === "admin" ? adminReportAction : moderatorReportAction;
  const closed = r.status === "RESOLVED" || r.status === "DISMISSED";
  const lockedForMod = mode === "moderator" && r.status === "ESCALATED";
  const hidden = { reportId: r.id };

  const shortcuts = [{ value: "NONE", label: "No other action" }];
  if (r.listing && r.listing.status !== "REMOVED") shortcuts.push({ value: "REMOVE_LISTING", label: "Also remove the listing" });
  if (r.review && !r.review.removedAt) shortcuts.push({ value: "REMOVE_REVIEW", label: "Also remove the review" });
  const hasUser = !!(r.reportedUser || r.listing || r.review || r.message);
  if (mode === "admin" && hasUser && r.reportedUser?.status !== "SUSPENDED" && r.reportedUser?.role !== "ADMIN") {
    shortcuts.push({ value: "SUSPEND_USER", label: "Also suspend the user" });
  }

  return (
    <article className="card p-4 sm:p-5" aria-label={`${humanize(r.target)} report`}>
      <header className="flex flex-wrap items-center gap-2">
        <Badge value={r.target} tint="lavender" />
        <Badge value={r.status} />
        {r.community && <span className="text-xs text-muted">{r.community.name}</span>}
        <span className="ml-auto text-xs text-muted">{fmtDateTime(r.createdAt)}</span>
      </header>

      <p className="mt-3 text-sm">
        <span className="text-muted">Reported by </span>
        <UserLink username={r.reporter.username} />
      </p>
      <blockquote className="mt-1 whitespace-pre-line rounded-lg border-l-2 border-accent bg-surface-2/60 px-3 py-2 text-sm">{r.reason}</blockquote>

      <div className="mt-3 rounded-xl border border-border p-3 text-sm">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Reported content</p>
        {r.reportedUser && (
          <p className="mt-1">
            User: <UserLink username={r.reportedUser.username} name={r.reportedUser.name} />{" "}
            {r.reportedUser.status !== "ACTIVE" && <Badge value={r.reportedUser.status} />}
          </p>
        )}
        {r.listing && (
          <p className="mt-1">
            Listing:{" "}
            <Link href={`/books/${r.listing.id}`} className="font-medium text-brand hover:underline">
              {r.listing.book.title}
            </Link>{" "}
            <span className="text-muted">by {r.listing.book.author}, owner @{r.listing.owner.username}</span>{" "}
            {r.listing.status === "REMOVED" && <Badge value="REMOVED" />}
          </p>
        )}
        {r.message && (
          <div className="mt-1">
            <p>
              Message from <span className="font-medium">@{r.message.sender.username}</span>
              {r.message.deletedAt && <span className="text-muted"> (deleted by sender)</span>}
            </p>
            <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-2/60 px-3 py-2">
              {r.message.type === "TEXT" ? r.message.body || "(empty)" : `(${r.message.type.toLowerCase()} message)`}
            </p>
          </div>
        )}
        {r.review && (
          <div className="mt-1">
            <p>
              Review by <span className="font-medium">@{r.review.reviewer.username}</span> of @{r.review.reviewee.username}:{" "}
              <span aria-label={`${r.review.rating} out of 5`}>{"★".repeat(r.review.rating)}{"☆".repeat(Math.max(0, 5 - r.review.rating))}</span>{" "}
              {r.review.removedAt && <Badge value="REMOVED" />}
            </p>
            {r.review.comment && <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-2/60 px-3 py-2">{r.review.comment}</p>}
          </div>
        )}
        {!r.reportedUser && !r.listing && !r.message && !r.review && <p className="mt-1 text-muted">The reported content no longer exists.</p>}
      </div>

      {(r.resolution || r.handledBy) && (
        <p className="mt-3 text-xs text-muted">
          {r.handledBy && <>Handled by @{r.handledBy.username}. </>}
          {r.resolution && <>Note: {r.resolution}</>}
          {r.resolvedAt && <> ({fmtDateTime(r.resolvedAt)})</>}
        </p>
      )}

      {!closed && !lockedForMod && (
        <div className="mt-4 flex flex-wrap items-start gap-1.5 border-t border-border pt-3">
          {r.status === "OPEN" && <ActionForm action={action} hidden={{ ...hidden, op: "UNDER_REVIEW" }} label="Mark under review" variant="secondary" />}
          <ActionForm
            action={action}
            hidden={{ ...hidden, op: "RESOLVE" }}
            label="Resolve"
            variant="primary"
            confirm="Resolve this report?"
            reason={{ name: "note", label: "Resolution note", required: true, placeholder: "What did you decide, and why?" }}
          >
            {shortcuts.length > 1 && <SelectField name="shortcut" label="Take action too" options={shortcuts} defaultValue="NONE" />}
          </ActionForm>
          {r.status !== "ESCALATED" && (
            <ActionForm
              action={action}
              hidden={{ ...hidden, op: "ESCALATE" }}
              label={mode === "moderator" ? "Escalate to admins" : "Escalate"}
              variant="secondary"
              confirm="Escalate this report? All admins are notified."
              reason={{ name: "note", label: "Why it needs an admin", required: mode === "moderator" }}
            />
          )}
          <ActionForm
            action={action}
            hidden={{ ...hidden, op: "DISMISS" }}
            label="Dismiss"
            variant="danger"
            confirm="Dismiss this report? No action is taken."
            reason={{ name: "note", label: "Note" }}
          />
        </div>
      )}
      {lockedForMod && <p className="mt-3 text-xs text-muted">Escalated. The admins will handle this one.</p>}
    </article>
  );
}
