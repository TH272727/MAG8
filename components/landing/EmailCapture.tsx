"use client";

import { useActionState } from "react";
import { subscribeEmail, type ActionState } from "@/app/actions";

const initial: ActionState = { ok: false, message: "" };

export default function EmailCapture() {
  const [state, action, pending] = useActionState(subscribeEmail, initial);

  return (
    <form action={action} className="w-full max-w-md">
      <div className="flex gap-2">
        <label htmlFor="email-capture" className="sr-only">
          Email address
        </label>
        <input
          id="email-capture"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-md border border-hairline bg-panel px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-dim focus:border-hairline2"
        />
        <button type="submit" disabled={pending} className="btn shrink-0">
          {pending ? "Saving…" : "Join the list"}
        </button>
      </div>
      <p className="mt-2 min-h-5 text-[13px]" aria-live="polite">
        {state.message ? (
          <span className={state.ok ? "text-fundamentals" : "text-danger"}>{state.message}</span>
        ) : (
          <span className="text-dim">Get new leaderboards when email publishing ships. No spam, ever.</span>
        )}
      </p>
    </form>
  );
}
