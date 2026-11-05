"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ListingType } from "@prisma/client";
import { createRequestAction, type ActionResult } from "@/app/actions/requests";
import { FormMessage, SubmitButton } from "@/components/form-bits";

const DAY_OPTIONS = [7, 14, 21, 30];

const COPY: Record<ListingType, { button: string; hint: string }> = {
  BORROW: { button: "Request to borrow", hint: "Ask to borrow it for a while, then return it to the owner." },
  EXCHANGE: { button: "Offer an exchange", hint: "Offer one of your own books in return." },
  GIVEAWAY: { button: "Ask for this book", hint: "The owner is giving it away for free." },
  SALE: { button: "Ask to buy", hint: "Agree the payment with the owner in person." },
};

export function RequestForm({
  listingId,
  type,
  myAvailable,
}: {
  listingId: string;
  type: ListingType;
  myAvailable: { id: string; label: string }[];
}) {
  const [state, action] = useActionState<ActionResult, FormData>(createRequestAction.bind(null, listingId), {});
  const [days, setDays] = useState("14");
  const [len, setLen] = useState(0);
  const noSwap = type === "EXCHANGE" && myAvailable.length === 0;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <p className="text-sm text-muted">{COPY[type].hint}</p>

      {type === "BORROW" && (
        <fieldset>
          <legend className="label">How long would you like it?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...DAY_OPTIONS.map(String), "custom"].map((v) => (
              <label
                key={v}
                className={`cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 ${
                  days === v ? "bg-sky font-semibold" : "bg-surface hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name="proposedDays"
                  value={v}
                  checked={days === v}
                  onChange={() => setDays(v)}
                  className="sr-only"
                />
                {v === "custom" ? "Other" : `${v} days`}
              </label>
            ))}
          </div>
          {days === "custom" && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                name="customDays"
                min={1}
                max={90}
                required
                defaultValue={10}
                className="input w-24"
                aria-label="Number of days (1 to 90)"
              />
              <span className="text-sm text-muted">days (1 to 90)</span>
            </div>
          )}
        </fieldset>
      )}

      {type === "EXCHANGE" &&
        (noSwap ? (
          <p className="rounded-xl bg-lavender p-3 text-sm">
            To offer a swap, list one of your own books first.{" "}
            <Link href="/books/new" className="font-semibold text-brand underline underline-offset-2">
              List a book
            </Link>
          </p>
        ) : (
          <div>
            <label htmlFor="offeredListingId" className="label">
              Book you&apos;ll offer
            </label>
            <select id="offeredListingId" name="offeredListingId" required className="input mt-1 w-full" defaultValue="">
              <option value="" disabled>
                Choose one of your books
              </option>
              {myAvailable.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        ))}

      <div>
        <label htmlFor="message" className="label">
          Message to the owner <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={500}
          onChange={(e) => setLen(e.target.value.length)}
          placeholder="Say hello and when you're usually free to meet."
          className="input mt-1 w-full resize-y"
        />
        <p className="mt-1 text-right text-xs text-muted">{len}/500</p>
      </div>

      <FormMessage state={state} />

      {!noSwap && (
        <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Sending...">
          {COPY[type].button}
        </SubmitButton>
      )}
    </form>
  );
}
