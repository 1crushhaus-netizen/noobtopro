// /llms-full.txt — the companion to /llms.txt: the ENTIRE Learn library (all 224
// guides) concatenated as clean Markdown, so an LLM can ingest the whole
// reasoning-first corpus in one fetch. Generated at build from the same curated
// guides the pages render (single source of truth), so it never drifts.
import { ORDER } from "@/lib/scoring";
import { conceptsFor, rootsFor, crossRootsFor } from "@/lib/curriculum";
import { loadGuides } from "@/lib/guides";
import {
  absolute,
  conceptUrl,
  subjectLabel,
  rankSeoLabel,
  PUBLIC_RANKS,
} from "@/lib/learn/seo";

export const dynamic = "force-static";

async function build() {
  const out = [];
  out.push("# noobtopro — full concept library");
  out.push("");
  out.push(
    "> Every concept guide on noobtopro (https://noobto.pro), in one file. noobtopro is a free, reasoning-first learning and assessment platform for mathematics, physics, and chemistry: it grades how you reason, not just the final answer. Each entry below gives a plain-English explanation, one fully worked example, and self-check questions for a single concept. 224 guides across three subjects and four levels (Elementary → University)."
  );
  out.push("");

  for (const subject of ORDER) {
    out.push(`## ${subjectLabel(subject)}`);
    out.push("");
    for (const rank of PUBLIC_RANKS) {
      const concepts = conceptsFor(subject, rank);
      if (concepts.length === 0) continue;
      const guides = (await loadGuides(subject, rank)) || {};
      out.push(`### ${rankSeoLabel(rank)} ${subjectLabel(subject)}`);
      out.push("");
      for (const c of concepts) {
        const g = guides[c.key];
        out.push(`#### ${c.label}`);
        out.push(`*${subjectLabel(subject)} · ${rankSeoLabel(rank)} · ${c.strand}*`);
        out.push("");
        if (g) {
          for (const p of g.explanation) {
            out.push(p);
            out.push("");
          }
          out.push("**Worked example**");
          out.push("");
          out.push(`Problem: ${g.example.problem}`);
          out.push("");
          g.example.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
          out.push("");
          out.push(`Answer: ${g.example.answer}`);
          out.push("");
          out.push("**Check your understanding**");
          out.push("");
          for (const q of g.selfQuestions) out.push(`- ${q}`);
          out.push("");
        }
        // Foundations (internal study order) — same- and cross-subject prerequisites.
        const roots = [
          ...rootsFor(subject, c.key).map((r) => r.label),
          ...crossRootsFor(subject, c.key).map((r) => `${r.label} (${subjectLabel(r.subject)})`),
        ];
        if (roots.length) {
          out.push(`Builds on: ${roots.join(", ")}.`);
          out.push("");
        }
        out.push(`Source: ${absolute(conceptUrl(subject, rank, c.key))}`);
        out.push("");
        out.push("---");
        out.push("");
      }
    }
  }

  return out.join("\n");
}

export async function GET() {
  return new Response(await build(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
