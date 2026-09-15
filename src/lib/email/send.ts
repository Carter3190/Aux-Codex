import "server-only";

import { getAppUrl } from "@/lib/stripe/config";
import {
  getTransactionalEmailConfig,
  isTransactionalEmailConfigured,
} from "./config";

type TransactionalEmail = {
  to: string;
  recipientName: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionPath: string;
  idempotencyKey: string;
};

export type TransactionalEmailResult =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "failed" };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plainText(input: TransactionalEmail, actionUrl: string) {
  return [
    `Hi ${input.recipientName},`,
    "",
    input.heading,
    input.message,
    "",
    `${input.actionLabel}: ${actionUrl}`,
    "",
    "Auxilium · Local help, made human",
  ].join("\n");
}

function html(input: TransactionalEmail, actionUrl: string) {
  const recipientName = escapeHtml(input.recipientName);
  const heading = escapeHtml(input.heading);
  const message = escapeHtml(input.message);
  const actionLabel = escapeHtml(input.actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f7f2;color:#17241f;font-family:Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${heading}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f2;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe5de;border-radius:24px;overflow:hidden">
            <tr>
              <td style="padding:24px 32px;background:#0f4f3d;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:3px">AUXILIUM</td>
            </tr>
            <tr>
              <td style="padding:36px 32px">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6">Hi ${recipientName},</p>
                <h1 style="margin:0 0 16px;color:#0f4f3d;font-size:28px;line-height:1.2">${heading}</h1>
                <p style="margin:0 0 28px;color:#5f7069;font-size:16px;line-height:1.7">${message}</p>
                <a href="${safeActionUrl}" style="display:inline-block;border-radius:999px;background:#17684f;color:#ffffff;padding:13px 22px;text-decoration:none;font-size:15px;font-weight:700">${actionLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4ebe6;color:#718078;font-size:13px;line-height:1.6">Auxilium · Local help, made human</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function safeIdempotencyKey(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

export async function sendTransactionalEmail(
  input: TransactionalEmail,
): Promise<TransactionalEmailResult> {
  if (!isTransactionalEmailConfigured()) return { status: "skipped" };

  try {
    const config = getTransactionalEmailConfig();
    const actionUrl = new URL(input.actionPath, `${getAppUrl()}/`).toString();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": safeIdempotencyKey(input.idempotencyKey),
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        html: html(input, actionUrl),
        text: plainText(input, actionUrl),
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error("Transactional email delivery failed", {
        notification: input.idempotencyKey,
        status: response.status,
      });
      return { status: "failed" };
    }

    return { status: "sent" };
  } catch (error) {
    console.error("Transactional email delivery failed", {
      notification: input.idempotencyKey,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "failed" };
  }
}
