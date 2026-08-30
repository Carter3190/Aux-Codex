"use client";

import { useActionState } from "react";
import { signUp } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/types";

type SignupFormProps = {
  defaultRole: "customer" | "provider";
};

export function SignupForm({ defaultRole }: SignupFormProps) {
  const [state, action, pending] = useActionState(signUp, initialAuthState);

  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">
          I want to
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name="role"
              value="customer"
              defaultChecked={defaultRole === "customer"}
            />
            <span className="block rounded-xl border border-border bg-white px-4 py-3 text-center text-sm font-semibold text-muted transition peer-checked:border-brand peer-checked:bg-[#eef6f1] peer-checked:text-brand-dark peer-focus-visible:ring-4 peer-focus-visible:ring-brand/15">
              Find help
            </span>
          </label>
          <label className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name="role"
              value="provider"
              defaultChecked={defaultRole === "provider"}
            />
            <span className="block rounded-xl border border-border bg-white px-4 py-3 text-center text-sm font-semibold text-muted transition peer-checked:border-brand peer-checked:bg-[#eef6f1] peer-checked:text-brand-dark peer-focus-visible:ring-4 peer-focus-visible:ring-brand/15">
              Offer services
            </span>
          </label>
        </div>
        {state.fieldErrors?.role && (
          <p className="mt-2 text-sm text-red-700">{state.fieldErrors.role[0]}</p>
        )}
      </fieldset>

      <div>
        <label
          htmlFor="fullName"
          className="text-sm font-semibold text-foreground"
        >
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-[#95a099] focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="Your full name"
        />
        {state.fieldErrors?.fullName && (
          <p className="mt-2 text-sm text-red-700">
            {state.fieldErrors.fullName[0]}
          </p>
        )}
      </div>

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
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-[#95a099] focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="you@example.com"
        />
        {state.fieldErrors?.email && (
          <p className="mt-2 text-sm text-red-700">{state.fieldErrors.email[0]}</p>
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
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        <p className="mt-2 text-xs leading-5 text-muted">
          Use 8 or more characters with at least one letter and one number.
        </p>
        {state.fieldErrors?.password && (
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {state.fieldErrors.password.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
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
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
