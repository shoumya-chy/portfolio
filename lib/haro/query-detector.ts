import type { QuerySource, JournalistQuery } from "./types";
import type { HaroConfig } from "./types";
import { isMessageSeen, markMessageSeen } from "./storage";
import { fetchInboxEmails } from "@/lib/api-clients/email-client";

// Known sender patterns for each source
const SOURCE_PATTERNS: { source: QuerySource; fromPatterns: string[]; subjectPatterns: string[] }[] = [
  {
    source: "sourcebottle",
    fromPatterns: ["sourcebottle", "source bottle"],
    subjectPatterns: ["source request", "media opportunity", "journalist query", "sourcebottle"],
  },
  {
    source: "qwoted",
    fromPatterns: ["qwoted"],
    subjectPatterns: ["qwoted", "expert request", "media query", "pitch opportunity"],
  },
  {
    source: "featured",
    fromPatterns: ["featured.com", "featured"],
    subjectPatterns: ["featured", "expert commentary", "press opportunity", "media request"],
  },
];

function detectSource(from: string, subject: string): QuerySource | null {
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  for (const pattern of SOURCE_PATTERNS) {
    const fromMatch = pattern.fromPatterns.some((p) => fromLower.includes(p));
    const subjectMatch = pattern.subjectPatterns.some((p) => subjectLower.includes(p));
    if (fromMatch || subjectMatch) return pattern.source;
  }

  return null;
}

function generateQueryId(): string {
  return "hq_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Parse email body to extract journalist queries.
 * Each source has a different email format, so we handle them individually.
 */
function parseQueryFromEmail(
  source: QuerySource,
  subject: string,
  body: string
): { journalistName: string; outlet: string; topic: string; queryText: string; deadline: string; requirements: string; replyToEmail: string }[] {
  const queries: { journalistName: string; outlet: string; topic: string; queryText: string; deadline: string; requirements: string; replyToEmail: string }[] = [];

  // Clean HTML tags from body
  const cleanBody = body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Extract email addresses from body for reply-to
  const emailMatches = cleanBody.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [];
  const replyEmails = emailMatches.filter(
    (e) =>
      !e.includes("unsubscribe") &&
      !e.includes("sourcebottle") &&
      !e.includes("qwoted") &&
      !e.includes("featured.com") &&
      !e.includes("noreply") &&
      !e.includes("no-reply") &&
      !e.includes("mailer")
  );

  // Extract deadline patterns
  const deadlineMatch = cleanBody.match(
    /(?:deadline|due|respond by|expires?|by)\s*:?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
  );
  const deadline = deadlineMatch ? deadlineMatch[1].trim() : "";

  if (source === "sourcebottle") {
    // SourceBottle sends digest emails with multiple queries separated by sections
    const sections = cleanBody.split(/(?:#{2,}|={2,}|-{3,}|Source Request|Media Opportunity)/i).filter((s) => s.trim().length > 50);

    if (sections.length > 1) {
      for (const section of sections.slice(0, 5)) {
        const topicMatch = section.match(/(?:topic|subject|re|looking for)\s*:?\s*(.{10,100})/i);
        const nameMatch = section.match(/(?:journalist|reporter|writer|from|by)\s*:?\s*([A-Z][a-z]+ [A-Z][a-z]+)/i);
        const outletMatch = section.match(/(?:outlet|publication|for)\s*:?\s*([A-Za-z][\w\s&'-]+)/i);

        queries.push({
          journalistName: nameMatch ? nameMatch[1].trim() : "",
          outlet: outletMatch ? outletMatch[1].trim() : "",
          topic: topicMatch ? topicMatch[1].trim() : subject,
          queryText: section.trim().slice(0, 2000),
          deadline,
          requirements: "",
          replyToEmail: replyEmails[0] || "",
        });
      }
    } else {
      queries.push({
        journalistName: "",
        outlet: "",
        topic: subject,
        queryText: cleanBody.slice(0, 2000),
        deadline,
        requirements: "",
        replyToEmail: replyEmails[0] || "",
      });
    }
  } else {
    // Qwoted, Featured — typically one query per email
    const nameMatch = cleanBody.match(/(?:journalist|reporter|from|by|name)\s*:?\s*([A-Z][a-z]+ [A-Z][a-z]+)/i);
    const outletMatch = cleanBody.match(/(?:outlet|publication|media|for)\s*:?\s*([A-Za-z][\w\s&'-]+?)(?:\s*[\n,.|])/i);
    const topicMatch = cleanBody.match(/(?:topic|subject|query|question|looking for|seeking)\s*:?\s*(.{10,200})/i);
    const reqMatch = cleanBody.match(/(?:requirements?|word count|length|format)\s*:?\s*(.{10,200})/i);

    queries.push({
      journalistName: nameMatch ? nameMatch[1].trim() : "",
      outlet: outletMatch ? outletMatch[1].trim() : "",
      topic: topicMatch ? topicMatch[1].trim() : subject,
      queryText: cleanBody.slice(0, 2000),
      deadline,
      requirements: reqMatch ? reqMatch[1].trim() : "",
      replyToEmail: replyEmails[0] || "",
    });
  }

  return queries.filter((q) => q.queryText.length > 20);
}

/**
 * Check inbox for journalist queries from SourceBottle, Qwoted, Featured.
 * Returns newly detected queries.
 */
export async function checkForQueries(config: HaroConfig): Promise<JournalistQuery[]> {
  console.log(`[HARO] Checking inbox: ${config.emailAddress}`);

  // Fetch emails from last 3 days
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const emails = await fetchInboxEmails(config.imapConfig, since);

  console.log(`[HARO] Found ${emails.length} emails in inbox`);

  const newQueries: JournalistQuery[] = [];

  for (const email of emails) {
    // Skip already-processed emails
    if (email.messageId && isMessageSeen(email.messageId)) continue;

    // Check if email is from a known source
    const source = detectSource(email.from, email.subject);
    if (!source) continue;

    console.log(`[HARO] Detected ${source} email: "${email.subject}" from ${email.from}`);

    // Parse queries from the email
    const parsed = parseQueryFromEmail(source, email.subject, email.text);

    for (const q of parsed) {
      const query: JournalistQuery = {
        id: generateQueryId(),
        configId: config.id,
        source,
        sourceEmailFrom: email.from,
        sourceEmailSubject: email.subject,
        sourceEmailDate: email.date.toISOString(),
        sourceMessageId: email.messageId,
        journalistName: q.journalistName,
        outlet: q.outlet,
        topic: q.topic,
        queryText: q.queryText,
        deadline: q.deadline,
        requirements: q.requirements,
        replyToEmail: q.replyToEmail,
        status: "new",
        aiResponse: "",
        responseSentAt: "",
        responseMessageId: "",
        createdAt: new Date().toISOString(),
        error: "",
      };

      newQueries.push(query);
    }

    // Mark email as processed
    if (email.messageId) markMessageSeen(email.messageId);
  }

  console.log(`[HARO] ${newQueries.length} new queries detected`);
  return newQueries;
}
