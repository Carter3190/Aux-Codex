"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/types";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialAuthState);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="text-sm font-semibold text-foreground">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-[#95a099] focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="you@example.com"
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="mt-2 text-sm text-red-700">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-sm font-semibold text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="mt-2 text-sm text-red-700">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-5 py-3.5 font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
