"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/types";
import styles from "./auth.module.css";

type SignupFormProps = { defaultRole: "customer" | "provider" };

export function SignupForm({ defaultRole }: SignupFormProps) {
  const [state, action, pending] = useActionState(signUp, initialAuthState);
  const [role, setRole] = useState(defaultRole);
  const [agreed, setAgreed] = useState(false);

  function chooseRole(nextRole: "customer" | "provider") {
    if (nextRole === role) return;
    setRole(nextRole);
    setAgreed(false);
  }

  return (
    <form action={action} className={styles.form}>
      <p className={styles.formDescription} aria-live="polite">Create a {role} account to get started.</p>
      <fieldset className={styles.roleFieldset}>
        <legend>I want to</legend>
        <div className={styles.roles}>
          <label className={styles.roleChoice}>
            <input type="radio" name="role" value="customer" checked={role === "customer"} onChange={() => chooseRole("customer")} />
            <span>Find help</span>
          </label>
          <label className={styles.roleChoice}>
            <input type="radio" name="role" value="provider" checked={role === "provider"} onChange={() => chooseRole("provider")} />
            <span>Offer services</span>
          </label>
        </div>
        {state.fieldErrors?.role && <p className={styles.error}>{state.fieldErrors.role[0]}</p>}
      </fieldset>
      <label className={styles.field} htmlFor="signup-name">
        Full name
        <input id="signup-name" name="fullName" type="text" autoComplete="name" required maxLength={100} placeholder="Your full name" />
        {state.fieldErrors?.fullName && <span className={styles.error}>{state.fieldErrors.fullName[0]}</span>}
      </label>
      <label className={styles.field} htmlFor="signup-email">
        Email address
        <input id="signup-email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        {state.fieldErrors?.email && <span className={styles.error}>{state.fieldErrors.email[0]}</span>}
      </label>
      <label className={styles.field} htmlFor="signup-password">
        Password
        <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required placeholder="Create a password" aria-describedby="signup-password-help" />
        <span id="signup-password-help" className={styles.help}>Use 8 or more characters with at least one letter and one number.</span>
        {state.fieldErrors?.password && <span className={styles.error}>{state.fieldErrors.password.join(" ")}</span>}
      </label>
      <div>
        <label className={styles.consent}>
          <input type="checkbox" name="terms" value="accepted" required checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          <span>
            I agree to the current <Link href="/terms" className={styles.textLink}>Terms of Service</Link> and acknowledge the <Link href="/privacy" className={styles.textLink}>Privacy Policy</Link>.
            {role === "provider" && <> I also agree to the <Link href="/provider-agreement" className={styles.textLink}>Provider Agreement</Link> and <Link href="/provider-standards" className={styles.textLink}>Provider Standards</Link>.</>}
          </span>
        </label>
        {state.fieldErrors?.terms && <p className={styles.error}>{state.fieldErrors.terms[0]}</p>}
      </div>
      {state.message && <p role="alert" className={styles.alert}>{state.message}</p>}
      <button type="submit" disabled={pending} className={styles.primary}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
