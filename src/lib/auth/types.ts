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
