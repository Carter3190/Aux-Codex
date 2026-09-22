import "server-only";

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function extractEmail(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const bracketed = trimmed.match(/<([^<>]+)>/)?.[1]?.trim();
  const email = bracketed ?? trimmed;
  return emailPattern.test(email) ? email : null;
}

export function getSupportEmail() {
  return (
    extractEmail(process.env.SUPPORT_EMAIL) ??
    extractEmail(process.env.EMAIL_REPLY_TO)
  );
}

export function isSupportContactConfigured() {
  return Boolean(getSupportEmail());
}
