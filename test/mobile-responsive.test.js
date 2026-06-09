import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Regression guards for the mobile UI/UX hardening (verified on emulated iPhone/Android
// viewports 320–412px). These pin the intent of the responsive fixes so a future refactor
// of globals.css / layout / charts can't silently re-introduce the issues:
//   - horizontal overflow on the graded-feedback ScoreBreakdown table (≤360px)
//   - sub-24px (WCAG 2.5.8) / sub-44px (Apple HIG, Material) touch targets
//   - a <16px text input that triggers iOS zoom-on-focus
//   - missing viewport-fit / safe-area handling
//   - unreadably small chart labels on a narrow column

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const css = read("app/globals.css");
const layout = read("app/layout.js");
const charts = read("components/charts.jsx");

// Extract the declaration body of a single (flat) CSS rule `selector { ... }`.
function ruleBody(selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : null;
}

describe("mobile: touch targets meet a comfortable size", () => {
  // Apple HIG 44px / Material 48dp; WCAG 2.5.8 AA floor is 24px. The primary controls
  // get a >=44px hit area.
  for (const sel of [".np-btn", ".np-tab", ".np-signinbtn", ".np-skip", ".np-ghost", ".np-iconbtn"]) {
    it(`${sel} has min-height: 44px`, () => {
      const body = ruleBody(sel);
      expect(body, `rule ${sel} {} not found`).toBeTruthy();
      expect(body).toContain("min-height: 44px");
    });
  }

  it(".np-iconbtn also has min-width: 44px (square icon hit area)", () => {
    expect(ruleBody(".np-iconbtn")).toContain("min-width: 44px");
  });

  it("the score-breakdown / worked-solution disclosure summaries are >=44px", () => {
    expect(css).toMatch(/summary\.np-cardicon\s*\{[^}]*min-height:\s*44px/);
  });

  it("the weak-concept and concept chips reach 44px on phones (<=480px)", () => {
    expect(css).toMatch(/@media \(max-width:\s*480px\)/);
    // a 480px block bumps the chips to 44px
    expect(css).toMatch(/\.np-weaktag-btn,\s*\.np-concepttag\s*\{\s*min-height:\s*44px/);
  });
});

describe("mobile: the graded-feedback table fits a narrow viewport", () => {
  it("shrinks the ScoreBreakdown fixed columns at <=480px (was 92/52/52, overflowed at 320)", () => {
    const block = css.match(/@media \(max-width:\s*480px\)\s*\{([\s\S]*?)\n\}/);
    expect(block, "480px media block not found").toBeTruthy();
    expect(block[1]).toContain(".np-brkbar");
    expect(block[1]).toMatch(/\.np-brkbar\s*\{\s*width:\s*54px/);
    expect(block[1]).toMatch(/\.np-brkpts\s*\{\s*width:\s*42px/);
  });
});

describe("mobile: inputs don't trigger iOS zoom-on-focus", () => {
  it(".np-hub-search is 16px (not 15)", () => {
    const body = ruleBody(".np-hub-search");
    expect(body).toBeTruthy();
    expect(body).toContain("font-size: 16px");
    expect(body).not.toContain("font-size: 15px");
  });

  it("the answer textarea (.np-input) stays >=16px", () => {
    expect(ruleBody(".np-input")).toContain("font-size: 16px");
  });
});

describe("mobile: viewport-fit + safe-area insets", () => {
  it("layout exports a viewport with viewport-fit: cover", () => {
    expect(layout).toMatch(/export const viewport\s*=/);
    expect(layout).toContain("viewportFit");
    expect(layout).toContain("cover");
  });

  it(".np-shell pads for the bottom safe-area inset", () => {
    expect(ruleBody(".np-shell")).toContain("env(safe-area-inset-bottom)");
  });

  it("the modal backdrop and drawer respect safe-area insets", () => {
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("env(safe-area-inset-top)");
  });
});

describe("mobile: chart labels are legible on a narrow column", () => {
  it("radar spoke labels were enlarged from 12 to 16 user units", () => {
    expect(charts).toContain("fontSize: 16, fontWeight: 500");
    expect(charts).not.toContain("fontSize: 12, fontWeight: 500");
  });

  it("line/bar chart labels were enlarged from 11 to 13", () => {
    expect(charts).not.toMatch(/fontSize:\s*11\b/);
  });
});
