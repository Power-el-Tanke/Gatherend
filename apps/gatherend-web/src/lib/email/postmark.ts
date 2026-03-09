import "server-only";

import { ServerClient } from "postmark";

import { db } from "../db";
import { logger } from "../logger";

type PostmarkEmailInput = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  tag?: string;
};

let cachedClient: ServerClient | null = null;
let warnedMissingConfig = false;

function getPostmarkConfig():
  | {
      serverToken: string;
      from: string;
      messageStream?: string;
    }
  | null {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN;
  const fromEmail = process.env.POSTMARK_FROM_EMAIL;

  if (!serverToken || !fromEmail) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[POSTMARK] Missing POSTMARK_SERVER_TOKEN and/or POSTMARK_FROM_EMAIL.",
      );
    }
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.server(
        "[POSTMARK] Missing POSTMARK_SERVER_TOKEN and/or POSTMARK_FROM_EMAIL; email sending disabled.",
      );
    }
    return null;
  }

  const fromName = process.env.POSTMARK_FROM_NAME;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  return {
    serverToken,
    from,
    messageStream: process.env.POSTMARK_MESSAGE_STREAM || undefined,
  };
}

function getClient(serverToken: string): ServerClient {
  if (cachedClient) return cachedClient;
  cachedClient = new ServerClient(serverToken);
  return cachedClient;
}

export async function sendPostmarkEmail(input: PostmarkEmailInput): Promise<void> {
  const to = input.to.toLowerCase().trim();
  if (!to) return;

  const suppression = await db.emailSuppression.findUnique({
    where: { email: to },
  });
  if (suppression?.isSuppressed) {
    logger.server("[POSTMARK] Suppressed recipient; skipping email send.", {
      to,
      tag: input.tag,
    });
    return;
  }

  const config = getPostmarkConfig();
  if (!config) return;

  const client = getClient(config.serverToken);

  try {
    await client.sendEmail({
      From: config.from,
      To: to,
      Subject: input.subject,
      HtmlBody: input.htmlBody,
      TextBody: input.textBody,
      ...(config.messageStream ? { MessageStream: config.messageStream } : {}),
      ...(input.tag ? { Tag: input.tag } : {}),
    });
  } catch (err) {
    // Don't log URLs/tokens (they might be included in the email body).
    logger.server("[POSTMARK] Failed to send email.", {
      to: input.to,
      subject: input.subject,
      tag: input.tag,
      error: err instanceof Error ? err.message : String(err),
    });
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
  }
}
