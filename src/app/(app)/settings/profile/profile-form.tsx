"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Props = {
  genres: { id: string; name: string }[];
  initial: { name: string; username: string; bio: string; neighbourhood: string; city: string; genreIds: string[] };
};

const CHIP_FILLS = [
  "peer-checked:bg-mint",
  "peer-checked:bg-peach",
  "peer-checked:bg-lavender",
  "peer-checked:bg-sky",
  "peer-checked:bg-butter",
  "peer-checked:bg-rose",
];

export function ProfileForm({ genres, initial }: Props) {
  const [state, action] = useActionState(updateProfileAction, {});

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6 [&_.input:focus]:border-brand [&_.input:focus]:ring-4 [&_.input:focus]:ring-mint">
      <h2 className="heading text-2xl font-semibold">About you</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" name="name" defaultValue={initial.name} required maxLength={80} className="input" />
        </div>
        <div>
          <label htmlFor="username" className="label">Username</label>
          <input
            id="username"
            name="username"
            defaultValue={initial.username}
            required
            pattern="[a-zA-Z0-9_]{3,20}"
            title="3–20 letters, numbers or underscores"
            className="input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="bio" className="label">Short bio</label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio}
          maxLength={300}
          rows={3}
          placeholder="What do you love to read?"
          className="input resize-y"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="neighbourhood" className="label">Neighbourhood</label>
          <input id="neighbourhood" name="neighbourhood" defaultValue={initial.neighbourhood} maxLength={80} className="input" placeholder="e.g. Koramangala" />
        </div>
        <div>
          <label htmlFor="city" className="label">City</label>
          <input id="city" name="city" defaultValue={initial.city} maxLength={80} className="input" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted">Shown publicly. Never enter your street address.</p>

      <fieldset>
        <legend className="label">Favourite genres</legend>
        {genres.length === 0 ? (
          <p className="text-sm text-muted">No genres yet. Run <code>npm run db:seed</code> to add them.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {genres.map((g, i) => (
              <label key={g.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="genres"
                  value={g.id}
                  defaultChecked={initial.genreIds.includes(g.id)}
                  className="peer sr-only"
                />
                <span className={`inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors peer-checked:border-brand peer-checked:text-brand ${CHIP_FILLS[i % CHIP_FILLS.length]} peer-focus-visible:outline-2 peer-focus-visible:outline-brand`}>
                  {g.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingText="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
