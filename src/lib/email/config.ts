import "server-only";

const resendApiKey = process.env.RESEND_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim().replace(
  /^("?)Auxilium\1(?=\s*<)/i,
  "$1Auxillium$1",
);
const emailReplyTo = process.env.EMAIL_REPLY_TO?.trim();

export function isTransactionalEmailConfigured() {
  return Boolean(resendApiKey?.startsWith("re_") && emailFrom);
}

export function getTransactionalEmailConfig() {
  if (!resendApiKey?.startsWith("re_") || !emailFrom) {
    throw new Error(
      "Transactional email is not configured. Add RESEND_API_KEY and EMAIL_FROM.",
    );
  }

  return {
    apiKey: resendApiKey,
    from: emailFrom,
    replyTo: emailReplyTo || undefined,
  };
}
