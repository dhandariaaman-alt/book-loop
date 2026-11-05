"use client";

import { useActionState, useState } from "react";
import { openDisputeAction, submitReviewAction } from "@/app/actions/trust";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { DISPUTE_KINDS } from "@/lib/trust-labels";

const STAR_WORDS = ["", "Poor", "Not great", "Okay", "Good", "Wonderful"];

export function ReviewForm({ transactionId, otherName }: { transactionId: string; otherName: string }) {
  const [state, action] = useActionState(submitReviewAction, {});
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const shown = hover || rating;

  if (state.success) return <FormMessage state={state} />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="transactionId" value={transactionId} />
      <fieldset>
        <legend className="label">How was your hand-off with {otherName}?</legend>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/50"
                onMouseEnter={() => setHover(n)}
              >
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  required
                  className="sr-only"
                />
                <span className="sr-only">
                  {n} {n === 1 ? "star" : "stars"}: {STAR_WORDS[n]}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`h-8 w-8 transition-transform motion-safe:hover:scale-110 ${n <= shown ? "text-accent" : "text-border"}`}
                  fill="currentColor"
                >
                  <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
                </svg>
              </label>
            ))}
          </div>
          <span className="font-hand text-xl text-muted" aria-live="polite">
            {STAR_WORDS[shown]}
          </span>
        </div>
      </fieldset>
      <div>
        <label htmlFor={`review-${transactionId}`} className="label">
          A few words <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={`review-${transactionId}`}
          name="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          className="input resize-y"
          placeholder="Friendly, on time, book as described…"
        />
        <p className="mt-1 text-right text-xs text-muted">{comment.length}/1000</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Saving…">
        Submit rating
      </SubmitButton>
    </form>
  );
}

export function DisputeForm({ transactionId }: { transactionId: string }) {
  const [state, action] = useActionState(openDisputeAction, {});
  const [description, setDescription] = useState("");

  if (state.success) return <FormMessage state={state} />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="transactionId" value={transactionId} />
      <div>
        <label htmlFor={`kind-${transactionId}`} className="label">
          What went wrong?
        </label>
        <select id={`kind-${transactionId}`} name="kind" required defaultValue="" className="input">
          <option value="" disabled>
            Choose one
          </option>
          {DISPUTE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`desc-${transactionId}`} className="label">
          Tell us what happened
        </label>
        <textarea
          id={`desc-${transactionId}`}
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="input resize-y"
          placeholder="Dates, what was agreed and what happened instead."
        />
        <p className="mt-1 text-right text-xs text-muted">{description.length}/2000</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText="Sending…">
        Send to BookLoop
      </SubmitButton>
    </form>
  );
}
