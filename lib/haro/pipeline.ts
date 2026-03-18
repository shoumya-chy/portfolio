import { checkForQueries } from "./query-detector";
import { generateResponse } from "./response-generator";
import { getHaroConfig, saveQuery, saveQueriesBatch, getHaroStats } from "./storage";
import { sendEmail } from "@/lib/api-clients/email-client";
import type { JournalistQuery } from "./types";

export interface PipelineResult {
  queriesFound: number;
  responsesGenerated: number;
  responsesSent: number;
  errors: string[];
  debug: string[];
}

/**
 * Full pipeline: check inbox → detect queries → generate responses → send replies
 */
export async function runHaroPipeline(): Promise<PipelineResult> {
  const result: PipelineResult = {
    queriesFound: 0,
    responsesGenerated: 0,
    responsesSent: 0,
    errors: [],
    debug: [],
  };

  const config = getHaroConfig();
  if (!config) {
    result.errors.push("HARO tool not configured. Set up your site and email details first.");
    return result;
  }

  if (!config.active) {
    result.debug.push("HARO auto-response is paused");
    return result;
  }

  // Step 1: Check inbox for new queries
  result.debug.push("Checking inbox...");
  let newQueries: JournalistQuery[];
  try {
    newQueries = await checkForQueries(config);
    result.queriesFound = newQueries.length;
    result.debug.push(`Found ${newQueries.length} new queries`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Inbox check failed: ${msg}`);
    return result;
  }

  if (newQueries.length === 0) {
    result.debug.push("No new queries to process");
    return result;
  }

  // Save all new queries first
  saveQueriesBatch(newQueries);

  // Step 2 & 3: Generate response and send for each query
  for (const query of newQueries) {
    try {
      // Skip if no reply-to email found
      if (!query.replyToEmail) {
        query.status = "skipped";
        query.error = "No reply email address found in query";
        saveQuery(query);
        result.debug.push(`Skipped "${query.topic}" — no reply email`);
        continue;
      }

      // Generate AI response
      result.debug.push(`Generating response for: "${query.topic.slice(0, 60)}..."`);
      const aiResult = await generateResponse(config, query);
      query.aiResponse = aiResult.response;
      result.responsesGenerated++;

      // Send the response via email
      const emailSubject = query.sourceEmailSubject.startsWith("Re:")
        ? query.sourceEmailSubject
        : `Re: ${query.sourceEmailSubject}`;

      const emailHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
${query.aiResponse.split("\n").map((line: string) => `<p>${line}</p>`).join("")}
${aiResult.relevantLinks.length > 0 ? `<p style="margin-top: 16px; font-size: 12px; color: #666;">Relevant resources: ${aiResult.relevantLinks.map((l: string) => `<a href="${l}">${l}</a>`).join(", ")}</p>` : ""}
</div>`;

      const messageId = await sendEmail(config.smtpConfig, config.emailAddress, {
        to: query.replyToEmail,
        subject: emailSubject,
        html: emailHtml,
        text: query.aiResponse,
      });

      query.status = "responded";
      query.responseSentAt = new Date().toISOString();
      query.responseMessageId = messageId;
      saveQuery(query);

      result.responsesSent++;
      result.debug.push(`Sent response to ${query.replyToEmail}`);

      console.log(`[HARO] Responded to query "${query.topic}" → ${query.replyToEmail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      query.status = "failed";
      query.error = msg;
      saveQuery(query);
      result.errors.push(`Failed "${query.topic}": ${msg}`);
    }
  }

  return result;
}

/**
 * Manual check-only (no auto-respond) — just find new queries
 */
export async function checkOnly(): Promise<{ queries: JournalistQuery[]; error?: string }> {
  const config = getHaroConfig();
  if (!config) {
    return { queries: [], error: "HARO tool not configured" };
  }

  try {
    const newQueries = await checkForQueries(config);
    if (newQueries.length > 0) {
      saveQueriesBatch(newQueries);
    }
    return { queries: newQueries };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { queries: [], error: msg };
  }
}
