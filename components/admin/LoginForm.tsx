"use client";

import { useActionState } from "react";
import { adminLogin, type ActionState } from "@/app/actions";

const initial: ActionState = { ok: false, message: "" };

export default function LoginForm() {
  const [state, action, pending] = useActionState(adminLogin, initial);

  return (
    <form action={action} className="panel max-w-sm p-5">
      <label htmlFor="admin-token" className="eyebrow">
        Admin token
      </label>
      <input
        id="admin-token"
        name="token"
        type="password"
        required
        autoComplete="current-password"
        placeholder="ADMIN_TOKEN"
        className="mt-2 w-full rounded-md border border-hairline bg-panel2 px-3.5 py-2.5 font-mono text-sm text-ink placeholder:text-dim focus:border-hairline2"
      />
      <button type="submit" disabled={pending} className="btn btn-primary mt-3 w-full">
        {pending ? "Checking…" : "Unlock the desk"}
      </button>
      <p className="mt-2 min-h-5 text-[13px] text-danger" aria-live="polite">
        {state.message}
      </p>
    </form>
  );
}
