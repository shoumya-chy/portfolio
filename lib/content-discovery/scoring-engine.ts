import type { Keyword, PAAQuestion, RelatedSearch, TrendingTopic, TopicCandidate } from "@/lib/types";
import type { WPPost } from "@/lib/api-clients/wordpress-client";

/**
 * Normalize a string for comparison
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Simple fuzzy similarity score (0-100) between two normalized strings.
 * Uses word overlap ratio — no external library needed.
 */
function fuzzySimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  const ratio = overlap / Math.min(wordsA.size, wordsB.size);
  return Math.round(ratio * 100);
}

/**
 * Check if a string contains navigational/junk patterns
 */
function isNavigational(s: string): boolean {
  const junk = ["login", "sign up", "signup", "sign in", "signin", "download", "install",
    "forgot password", "my account", "checkout", "cart", "register", "unsubscribe"];
  const lower = s.toLowerCase();
  return junk.some(j => lower.includes(j));
}

/**
 * Step 1: Build candidate topic list from all sources
 */
export function buildCandidatePool(
  gscKeywords: Keyword[],
  bingKeywords: Keyword[],
  paaQuestions: PAAQuestion[],
  relatedSearches: RelatedSearch[],
  quoraTopics: TrendingTopic[]
): TopicCandidate[] {
  const candidates = new Map<string, TopicCandidate>();

  // Helper: add or merge candidate
  function addCandidate(topic: string, source: string, gscImp: number = 0, gscPos: number = 0) {
    const norm = normalize(topic);
    if (norm.length < 10 || norm.split(/\s+/).length < 3) return; // Too short
    if (isNavigational(norm)) return;

    if (candidates.has(norm)) {
      const existing = candidates.get(norm)!;
      if (!existing.sources.includes(source)) existing.sources.push(source);
      if (gscImp > existing.gscImpressions) existing.gscImpressions = gscImp;
      if (gscPos > 0 && (existing.gscPosition === 0 || gscPos < existing.gscPosition)) existing.gscPosition = gscPos;
      if (source === "paa") existing.paaSource = true;
      if (source === "bing") existing.bingSignal = true;
      if (source === "quora") existing.quoraSignal = true;
    } else {
      candidates.set(norm, {
        topic,
        normalizedTopic: norm,
        score: 0,
        sources: [source],
        gscImpressions: gscImp,
        gscPosition: gscPos,
        paaSource: source === "paa",
        bingSignal: source === "bing",
        quoraSignal: source === "quora",
        wordCount: norm.split(/\s+/).length,
      });
    }
  }

  // GSC near-miss keywords (position 5-30, impressions > 5)
  for (const kw of gscKeywords) {
    if (kw.position >= 5 && kw.position <= 30 && kw.impressions >= 5) {
      addCandidate(kw.query, "gsc", kw.impressions, kw.position);
    }
  }

  // Bing keywords
  for (const kw of bingKeywords) {
    if (kw.impressions >= 3) {
      addCandidate(kw.query, "bing", kw.impressions, kw.position);
    }
  }

  // PAA questions
  for (const paa of paaQuestions) {
    addCandidate(paa.question, "paa");
  }

  // Related searches from DataForSEO
  for (const rs of relatedSearches) {
    addCandidate(rs.query, "related");
  }

  // Quora topics
  for (const qt of quoraTopics) {
    addCandidate(qt.title, "quora");
  }

  return Array.from(candidates.values());
}

/**
 * Step 2: Fuzzy dedup — merge candidates that are > 80% similar
 */
export function deduplicateCandidates(candidates: TopicCandidate[]): TopicCandidate[] {
  const result: TopicCandidate[] = [];

  for (const candidate of candidates) {
    let isDuplicate = false;
    for (const existing of result) {
      const similarity = fuzzySimilarity(candidate.normalizedTopic, existing.normalizedTopic);
      if (similarity >= 80) {
        // Merge sources and keep higher score
        for (const src of candidate.sources) {
          if (!existing.sources.includes(src)) existing.sources.push(src);
        }
        if (candidate.gscImpressions > existing.gscImpressions) {
          existing.gscImpressions = candidate.gscImpressions;
          existing.gscPosition = candidate.gscPosition;
        }
        existing.paaSource = existing.paaSource || candidate.paaSource;
        existing.bingSignal = existing.bingSignal || candidate.bingSignal;
        existing.quoraSignal = existing.quoraSignal || candidate.quoraSignal;
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) result.push(candidate);
  }

  return result;
}

/**
 * Step 3: Exclude candidates that match existing WordPress posts
 * Returns { passed, excluded }
 */
export function filterAgainstPublished(
  candidates: TopicCandidate[],
  wpPosts: WPPost[]
): { passed: TopicCandidate[]; excluded: { topic: string; matchedPost: string }[] } {
  const postTitles = wpPosts.map(p => normalize(p.title));
  const postSlugs = wpPosts.map(p => normalize(p.slug.replace(/-/g, " ")));
  const postFocusKws = wpPosts
    .filter(p => p.seo.focusKeyword)
    .map(p => normalize(p.seo.focusKeyword));

  const allPostTerms = [...postTitles, ...postSlugs, ...postFocusKws];

  const passed: TopicCandidate[] = [];
  const excluded: { topic: string; matchedPost: string }[] = [];

  for (const candidate of candidates) {
    let matched = false;
    for (let i = 0; i < allPostTerms.length; i++) {
      const sim = fuzzySimilarity(candidate.normalizedTopic, allPostTerms[i]);
      if (sim >= 75) {
        const postIndex = i < postTitles.length ? i :
          i < postTitles.length + postSlugs.length ? i - postTitles.length :
          i - postTitles.length - postSlugs.length;
        const matchedTitle = wpPosts[Math.min(postIndex, wpPosts.length - 1)]?.title || allPostTerms[i];
        excluded.push({ topic: candidate.topic, matchedPost: matchedTitle });
        matched = true;
        break;
      }
    }
    if (!matched) passed.push(candidate);
  }

  return { passed, excluded };
}

/**
 * Step 4: Score candidates (0-100)
 */
export function scoreCandidates(candidates: TopicCandidate[]): TopicCandidate[] {
  const maxImpressions = Math.max(...candidates.map(c => c.gscImpressions), 1);

  for (const c of candidates) {
    let score = 0;

    // GSC near-miss signal (30 points max) — scaled linearly by impressions
    if (c.gscImpressions > 0) {
      score += Math.round((c.gscImpressions / maxImpressions) * 30);
    }

    // PAA source (20 points) — questions = high intent
    if (c.paaSource) score += 20;

    // Quora signal (15 points) — people are actively asking
    if (c.quoraSignal) score += 15;

    // Bing signal (10 points) — cross-engine validation
    if (c.bingSignal) score += 10;

    // Multi-source bonus (10 points) — appears in 2+ sources
    if (c.sources.length >= 2) score += 10;

    // Keyword length sweet spot (10 points) — 3-7 words is ideal
    if (c.wordCount >= 3 && c.wordCount <= 7) score += 10;

    // Position opportunity bonus (5 points) — position 10-20 = close to page 1
    if (c.gscPosition >= 10 && c.gscPosition <= 20) score += 5;

    c.score = Math.min(score, 100);
  }

  return candidates.sort((a, b) => b.score - a.score);
}
