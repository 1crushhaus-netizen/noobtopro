// ---------------------------------------------------------------------------
// Server-only abuse / prompt-injection detection for the public API routes.
//
// Heuristic and high-precision (no LLM, no network): it FLAGS suspicious input
// for the admin dashboard — it NEVER blocks the request (flag-for-review, not
// deny, so a false positive can't lock a learner out). Flagged events are logged
// to the service-role-only `security_events` table via the admin client.
//
// This module is server-only (it imports the service-role client + next/server
// `after`). Never import it from a client component.
// ---------------------------------------------------------------------------

import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { clientKey } from "@/lib/rateLimit";

// High-precision injection markers. Deliberately AVOIDS generic STEM phrasing
// ("acts as a catalyst", "give me the answer") to keep the false-positive rate
// low — the goal is to surface real instruction-override / prompt-extraction /
// role-reassignment / jailbreak attempts, not normal learner input.
const MARKERS = [
  { re: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|above|prior|earlier|all)\b[^.\n]{0,30}\b(instructions?|prompts?|rules?|messages?)\b/i, sev: "high", label: "instruction-override" },
  // Override aimed at THIS app's grading task (rubric/grader/scoring) — catches
  // "disregard the rubric", "ignore the grading task", "override your scoring" that the
  // generic instruction-override pattern above misses. High-precision: these tokens do
  // not occur in genuine STEM reasoning.
  { re: /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(the\s+|all\s+|previous\s+|above\s+|prior\s+|earlier\s+|your\s+)?(grading|grader|rubric|scoring)\b/i, sev: "high", label: "grading-override" },
  // Coaxing the model to dump the answer/worked solution before the learner attempts —
  // only the imperative, extraction-shaped phrasings (a learner naturally writing "the
  // final answer is …" is NOT matched: no leak/reveal/output verb precedes it).
  { re: /\b(reveal|output|print|dump|leak|expose|show\s+me)\b[^.\n]{0,40}\b(the\s+)?(worked|full|complete|model|entire)\s+(solution|answer)\b/i, sev: "medium", label: "solution-extraction" },
  { re: /\bsystem\s+prompt\b/i, sev: "high", label: "system-prompt-probe" },
  { re: /\breveal\b[^.\n]{0,40}\b(system\s+)?(prompt|instructions?)\b/i, sev: "high", label: "prompt-extraction" },
  { re: /(^|\n)\s*(system|assistant)\s*:/i, sev: "high", label: "role-injection" },
  { re: /<\/?\s*(system|assistant|user)\s*>/i, sev: "high", label: "role-tag-injection" },
  { re: /\b(jailbreak|developer\s+mode|dan\s+mode)\b/i, sev: "high", label: "jailbreak" },
  { re: /\b(new|updated)\s+instructions?\s*:/i, sev: "high", label: "instruction-injection" },
  { re: /\boverride\b[^.\n]{0,30}\b(instructions?|rules?|system|prompt)\b/i, sev: "high", label: "override" },
  { re: /\byou\s+are\s+now\b/i, sev: "medium", label: "role-reassign" },
  { re: /\bpretend\s+to\s+be\b/i, sev: "medium", label: "role-reassign" },
];

/**
 * Scan free text for prompt-injection markers.
 * @returns {{flagged:boolean, severity:'high'|'medium'|null, matches:{label:string,severity:string,snippet:string}[]}}
 */
export function scanForInjection(text) {
  if (typeof text !== "string" || !text) return { flagged: false, severity: null, matches: [] };
  const matches = [];
  let severity = null;
  for (const m of MARKERS) {
    const hit = text.match(m.re);
    if (hit) {
      matches.push({ label: m.label, severity: m.sev, snippet: hit[0].slice(0, 120) });
      if (m.sev === "high") severity = "high";
      else if (severity !== "high") severity = "medium";
    }
  }
  return { flagged: matches.length > 0, severity, matches };
}

// ---------------------------------------------------------------------------
// INJECTION AUTO-DOCK THRESHOLD (audit P2-3 fix).
//
// A SUCCESSFUL prompt injection can coax the grader into inflating every rubric axis
// to 4/4 (score 100) — logging it (above) catches it for review but does nothing to
// the score in the moment. When the injection signal is HIGH-confidence we now also
// DOCK the attempt to a near-zero score (the deterministic dock in lib/preGrade.js):
// zero rubric, no LLM grade, no worked solution. The learner sees a normal docked
// result; the event is still logged for the admin dashboard.
//
// THRESHOLD (deliberately conservative — false positives must stay near zero):
//   - Dock ONLY on a HIGH-severity match. Every HIGH marker in MARKERS is an explicit
//     STRUCTURAL injection pattern — "ignore previous instructions", "disregard the
//     rubric", "<system>…", a leading "system:" line, "jailbreak / developer mode",
//     "reveal the system prompt", "new instructions:". These are high-precision by
//     construction (the module's MARKERS deliberately avoid generic STEM phrasing), so
//     they do not occur in genuine reasoning.
//   - MEDIUM markers ("you are now", "pretend to be", solution-extraction) do NOT dock:
//     they are softer / more ambiguous (closer to "mere keyword presence"), so they
//     only LOG. A benign answer that merely mentions a keyword (e.g. "the system's
//     internal energy", "I'm not sure how to override the default") never reaches a
//     HIGH marker and is never docked.
// Returns true when the scan warrants an auto-dock.
// ---------------------------------------------------------------------------
export function shouldDockForInjection(scan) {
  return !!(scan && scan.flagged && scan.severity === "high");
}

// In-memory throttle so a flood of hits from one source can't fill the table.
// One event per (kind:ip) per window. Best-effort; resets on cold start.
const THROTTLE_MS = 60_000;
const _lastLogged = new Map(); // "kind:ip" -> timestamp
function _throttled(key, now) {
  const prev = _lastLogged.get(key);
  if (prev != null && now - prev < THROTTLE_MS) return true;
  _lastLogged.set(key, now);
  if (_lastLogged.size > 5000) {
    for (const k of _lastLogged.keys()) {
      _lastLogged.delete(k);
      if (_lastLogged.size <= 4000) break;
    }
  }
  return false;
}

/**
 * Best-effort insert into security_events via the service-role client. No-op
 * (returns false) when the service-role key is unset or the write is throttled.
 * `now` is injectable for deterministic tests.
 */
export async function logSecurityEvent(ev, { now = Date.now() } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb) return false; // no service-role key -> logging disabled
  const kind = ev.kind || "other";
  if (_throttled(`${kind}:${ev.ip || "unknown"}`, now)) return false;
  const row = {
    kind,
    severity: ev.severity || "low",
    route: ev.route ? String(ev.route).slice(0, 120) : null,
    ip: ev.ip ? String(ev.ip).slice(0, 64) : null,
    user_id: ev.userId || null,
    subject: ev.subject ? String(ev.subject).slice(0, 32) : null,
    concept: ev.concept ? String(ev.concept).slice(0, 200) : null,
    sample: ev.sample ? String(ev.sample).slice(0, 500) : null,
    detail: ev.detail ?? null,
  };
  try {
    await sb.from("security_events").insert(row);
    return true;
  } catch (e) {
    console.error("[abuseDetection] logSecurityEvent", e); // best-effort
    return false;
  }
}

// Scan `text` and, if it looks like an injection attempt, log a (throttled,
// non-blocking) security_event. Returns the scan result. Safe to call inside a
// request handler; falls back to fire-and-forget outside a request scope (tests).
export function reportInjection({ req, route, subject = null, concept = null, text }) {
  const scan = scanForInjection(text);
  if (!scan.flagged) return scan;
  const task = () =>
    logSecurityEvent({
      kind: "prompt_injection",
      severity: scan.severity,
      route,
      ip: clientKey(req),
      subject,
      concept,
      sample: scan.matches.map((m) => m.snippet).join(" | "),
      detail: { matches: scan.matches.map((m) => m.label) },
    });
  try {
    after(task);
  } catch {
    void task();
  }
  return scan;
}

// Log a (throttled, non-blocking) rate-limit event — an abuse-volume signal.
export function reportRateLimit({ req, route }) {
  const task = () => logSecurityEvent({ kind: "rate_limit", severity: "low", route, ip: clientKey(req) });
  try {
    after(task);
  } catch {
    void task();
  }
}

// Test-only.
export function _resetThrottle() {
  _lastLogged.clear();
}
