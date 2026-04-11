import type { Keyword, PAAQuestion, RelatedSearch, TrendingTopic, TopicCandidate } from "@/lib/types";
import type { WPPost } from "@/lib/api-clients/wordpress-client";

/**
 * English stopword list — stripped before fuzzy comparison so that
 * common filler words don't inflate similarity scores.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
  "man", "new", "now", "old", "see", "two", "way", "who", "boy", "did",
  "its", "let", "put", "say", "she", "too", "use", "with", "your", "this",
  "that", "have", "from", "what", "when", "where", "why", "which", "who",
  "whom", "will", "would", "should", "could", "there", "their", "them",
  "they", "then", "than", "some", "such", "into", "also", "about", "been",
  "being", "best", "more", "most", "other", "only", "over", "under", "just",
  "like", "much", "many", "every", "each", "these", "those", "any", "does",
  "doing", "done", "down", "even", "ever", "here", "know", "make", "made",
  "well", "very", "after", "again", "still", "while", "before", "between",
  "through", "without", "within", "against", "because", "both", "same", "own",
]);

/**
 * Normalize a string for comparison
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function contentWords(s: string): string[] {
  return s
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Jaccard similarity on content words (0-100). Much more reliable than
 * the previous "overlap / min" formula which over-triggered dedup on
 * unrelated topics sharing one or two stopwords.
 *
 * Jaccard = |A ∩ B| / |A ∪ B|
 */
function fuzzySimilarity(a: string, b: string): number {
  const wordsA = new Set(contentWords(a));
  const wordsB = new Set(contentWords(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  if (union === 0) return 0;

  return Math.round((intersection / union) * 100);
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

  // GSC near-miss keywords — true "one more push" zone is position 8-25
  // with at least 15 impressions (filters noise from single-session data)
  for (const kw of gscKeywords) {
    if (kw.position >= 8 && kw.position <= 25 && kw.impressions >= 15) {
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
 * Step 3: Exclude candidates that match existing WordPress posts.
 *
 * Builds an index of (normalizedTerm → sourcePostTitle) so every
 * candidate comparison can recover the exact post it matched,
 * regardless of which of the title/slug/focusKw arrays the match
 * came from. Threshold lifted to 70% Jaccard to avoid false positives
 * from the stricter similarity formula.
 */
export function filterAgainstPublished(
  candidates: TopicCandidate[],
  wpPosts: WPPost[]
): { passed: TopicCandidate[]; excluded: { topic: string; matchedPost: string }[] } {
  // Build flat list of (term, originalPostTitle) pairs
  const termIndex: Array<{ term: string; postTitle: string }> = [];
  for (const p of wpPosts) {
    termIndex.push({ term: normalize(p.title), postTitle: p.title });
    termIndex.push({ term: normalize(p.slug.replace(/-/g, " ")), postTitle: p.title });
    if (p.seo?.focusKeyword) {
      termIndex.push({ term: normalize(p.seo.focusKeyword), postTitle: p.title });
    }
  }

  const passed: TopicCandidate[] = [];
  const excluded: { topic: string; matchedPost: string }[] = [];

  for (const candidate of candidates) {
    let matchedPostTitle: string | null = null;
    for (const entry of termIndex) {
      if (!entry.term) continue;
      const sim = fuzzySimilarity(candidate.normalizedTopic, entry.term);
      if (sim >= 70) {
        matchedPostTitle = entry.postTitle;
        break;
      }
    }
    if (matchedPostTitle) {
      excluded.push({ topic: candidate.topic, matchedPost: matchedPostTitle });
    } else {
      passed.push(candidate);
    }
  }

  return { passed, excluded };
}

/**
 * Step 4: Score candidates (0-100).
 *
 * Rebalanced weights:
 *   GSC impressions (log-scale)    → 0-25
 *   PAA (question intent)          →   25
 *   Quora (active asking)          →   15
 *   Bing (cross-engine validation) →   10
 *   Multi-source bonus             → 10 / 20 / 25 (2 / 3 / 4+ sources)
 *   Length sweet spot              →   10
 *   Position opportunity (10-15)   →    5
 *
 * Log-scale impressions prevents one monster keyword from flattening
 * everything else. Uses reduce() instead of Math.max(...spread) which
 * would crash on very large candidate arrays.
 */
export function scoreCandidates(candidates: TopicCandidate[]): TopicCandidate[] {
  if (candidates.length === 0) return candidates;

  // reduce() is stack-safe, unlike Math.max(...spread)
  const maxImpressions = candidates.reduce(
    (m, c) => (c.gscImpressions > m ? c.gscImpressions : m),
    1
  );
  // log-scale base — avoid divide-by-zero
  const logMax = Math.log(maxImpressions + 1) || 1;

  for (const c of candidates) {
    let score = 0;

    // GSC near-miss signal (0-25 points) — log-scaled so long tail still matters
    if (c.gscImpressions > 0) {
      const logImp = Math.log(c.gscImpressions + 1);
      score += Math.round((logImp / logMax) * 25);
    }

    // PAA source (25 points) — questions carry clear informational intent
    if (c.paaSource) score += 25;

    // Quora signal (15 points) — real users are actively asking
    if (c.quoraSignal) score += 15;

    // Bing signal (10 points) — cross-engine validation
    if (c.bingSignal) score += 10;

    // Multi-source bonus — scales with number of sources
    const srcCount = c.sources.length;
    if (srcCount >= 4) score += 25;
    else if (srcCount === 3) score += 20;
    else if (srcCount === 2) score += 10;

    // Keyword length sweet spot (10 points) — 3-8 words is ideal
    if (c.wordCount >= 3 && c.wordCount <= 8) score += 10;

    // Position opportunity bonus (5 points) — position 10-15 = one click off page 1
    if (c.gscPosition >= 10 && c.gscPosition <= 15) score += 5;

    c.score = Math.min(score, 100);
  }

  return candidates.sort((a, b) => b.score - a.score);
}
