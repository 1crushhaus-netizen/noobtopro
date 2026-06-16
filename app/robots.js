// Tells crawlers what they may index and where the sitemap lives. Next serves
// this at /robots.txt. SITE_URL is read from the env so preview deploys can
// point host/sitemap at their own origin (falls back to the production canonical).
//
// AEO policy: noobtopro is a free educational library that WANTS to be read,
// indexed, and cited by AI answer engines. We therefore EXPLICITLY allow the
// answer/search + user-action AI crawlers (the ones that drive citations) and the
// training crawlers (broad model knowledge of the brand + content). The only
// disallow is /api/ (non-content endpoints). Blocking these bots would not stop
// AI Overviews (those use the Google/Bing search index — which we keep open) but
// WOULD forfeit direct retrieval/citation, so we keep them all open.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://noobto.pro";

// Named AI agents we explicitly welcome (search/answer, user-initiated fetch, and
// training). Exact user-agent tokens per each operator's published crawler docs.
const AI_AGENTS = [
  "GPTBot", // OpenAI — training
  "OAI-SearchBot", // OpenAI — ChatGPT Search index (citations)
  "ChatGPT-User", // OpenAI — user-initiated fetch
  "ClaudeBot", // Anthropic — training
  "Claude-User", // Anthropic — user-initiated fetch
  "Claude-SearchBot", // Anthropic — search indexing (visibility in Claude answers)
  "anthropic-ai", // Anthropic — legacy token
  "PerplexityBot", // Perplexity — search index (citations)
  "Perplexity-User", // Perplexity — user-initiated fetch
  "Google-Extended", // Google — Gemini/Vertex grounding+training token
  "Applebot-Extended", // Apple — Apple Intelligence training token
  "CCBot", // Common Crawl — open dataset used to train many LLMs
  "Meta-ExternalAgent", // Meta — AI crawler
];

export default function robots() {
  return {
    rules: [
      // Default policy for every crawler (Googlebot, Bingbot, Applebot, …).
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      // Explicit, intentional allow for the AI answer/training crawlers.
      { userAgent: AI_AGENTS, allow: "/", disallow: ["/api/"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
