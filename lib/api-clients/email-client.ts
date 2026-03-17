import nodemailer from "nodemailer";
import type { SmtpConfig, ImapConfig } from "@/lib/outreach/types";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(config: SmtpConfig, from: string, options: SendEmailOptions): Promise<string> {
  // Port 587 = STARTTLS (secure: false, upgrades via STARTTLS)
  // Port 465 = direct SSL (secure: true)
  const useDirectSSL = config.port === 465 || config.secure;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: useDirectSSL,
    auth: {
      user: config.username,
      pass: config.password,
    },
    // For STARTTLS on port 587, nodemailer auto-upgrades when secure=false
    tls: {
      rejectUnauthorized: true,
    },
  });

  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]+>/g, ""),
    replyTo: options.replyTo || from,
  });

  return info.messageId || "";
}

export interface InboxMessage {
  messageId: string;
  from: string;
  subject: string;
  text: string;
  date: Date;
  inReplyTo?: string;
}

export async function fetchInboxEmails(config: ImapConfig, since: Date): Promise<InboxMessage[]> {
  // Dynamic import to avoid crashing the module if imapflow has issues
  const { ImapFlow } = await import("imapflow");

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  });

  const messages: InboxMessage[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchResult = await client.search({ since });
      if (!searchResult || !Array.isArray(searchResult)) {
        lock.release();
        await client.logout();
        return messages;
      }

      for (const seq of searchResult) {
        try {
          const msg = await client.fetchOne(seq, { envelope: true, source: true });
          if (!msg) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fetchMsg = msg as any;
          if (!fetchMsg.envelope) continue;

          const env = fetchMsg.envelope;
          const fromAddr = env.from?.[0]?.address || "";
          const text = fetchMsg.source ? fetchMsg.source.toString("utf-8") : "";

          // Extract plain text body
          let body = text;
          const textMatch = text.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n)/);
          if (textMatch) body = textMatch[1];

          messages.push({
            messageId: env.messageId || "",
            from: fromAddr,
            subject: env.subject || "",
            text: body.slice(0, 2000),
            date: env.date || new Date(),
            inReplyTo: env.inReplyTo || undefined,
          });
        } catch {
          // Skip individual message errors
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.log("[IMAP] Error:", err instanceof Error ? err.message : err);
    try { await client.logout(); } catch { /* ignore */ }
  }

  return messages;
}
