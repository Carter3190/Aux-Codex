"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/types";
import styles from "./auth.module.css";

export function LoginForm({ nextPath }: { nextPath?: string } = {}) {
  const [state, action, pending] = useActionState(signIn, initialAuthState);

  return (
    <form action={action} className={styles.form}>
      {nextPath && <input type="hidden" name="next" value={nextPath} />}
      <label className={styles.field} htmlFor="login-email">
        Email address
        <input id="login-email" name="email" type="email" autoComplete="email" required
          aria-describedby={state.fieldErrors?.email ? "login-email-error" : undefined}
          placeholder="you@example.com" />
        {state.fieldErrors?.email && <span id="login-email-error" className={styles.error}>{state.fieldErrors.email[0]}</span>}
      </label>
      <label className={styles.field} htmlFor="login-password">
        Password
        <input id="login-password" name="password" type="password" autoComplete="current-password" required
          aria-describedby={state.fieldErrors?.password ? "login-password-error" : undefined}
          placeholder="Your password" />
        {state.fieldErrors?.password && <span id="login-password-error" className={styles.error}>{state.fieldErrors.password[0]}</span>}
      </label>
      {state.message && <p role="alert" className={styles.alert}>{state.message}</p>}
      <button type="submit" disabled={pending} className={styles.primary}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
