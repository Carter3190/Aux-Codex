export type AuthFieldErrors = {
  fullName?: string[];
  email?: string[];
  password?: string[];
  role?: string[];
  terms?: string[];
};

export type AuthFormState = {
  message?: string;
  fieldErrors?: AuthFieldErrors;
};

export const initialAuthState: AuthFormState = {};

export type ConfirmationFormState = {
  message?: string;
  fieldErrors?: Pick<AuthFieldErrors, "email">;
  retryAfterSeconds?: number;
};

export const initialConfirmationState: ConfirmationFormState = {};
