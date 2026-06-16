import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// KISS flat config: high-signal correctness rules + a server-only-secret import
// boundary + React Hooks rules. Deliberately NOT eslint-config-next — its
// core-web-vitals rules would flood a mature, never-linted codebase with churn.
// `npm run lint` fails on ERRORS; stylistic findings are advisory (warn) so the gate
// is green today and can be ratcheted up later.

// Shared rule tuning for app source + maintenance scripts (no React here).
const sharedRules = {
  ...js.configs.recommended.rules,
  // Advisory, not blocking — mature code holds intentional unused bindings.
  "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  // This codebase's content-safety / key-sanitization layer (lib/contentSafety.js,
  // lib/conceptKey.js) DELIBERATELY matches control chars and zero-width / irregular
  // whitespace — that detection IS the feature, not a typo. Allow them inside regex /
  // string / template data, while still catching genuinely accidental irregular
  // whitespace in actual code.
  "no-control-regex": "off",
  "no-irregular-whitespace": [
    "error",
    { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true },
  ],
  // Allow the intentional best-effort `catch {}` idiom (sessionStorage in private
  // mode / SSR, best-effort sign-out) while still flagging empty if/for/while blocks.
  "no-empty": ["error", { allowEmptyCatch: true }],
  // Newer, aggressive rule: flags a defensive `let x = false` whose initial value is
  // provably overwritten before use (e.g. lib/rateLimit.js). That code is correct and
  // tested; surface as advisory rather than force a rewrite of a security path.
  "no-useless-assignment": "warn",
};

export default [
  {
    // Build output, deps, coverage, generated files — never lint these.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },

  // Application source (Next App Router + libs): ESM, browser + node globals, JSX,
  // and React Hooks correctness (rules-of-hooks catches conditional hook calls).
  {
    files: ["lib/**/*.{js,jsx}", "app/**/*.{js,jsx}", "components/**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...sharedRules,
      "react-hooks/rules-of-hooks": "error",
      // Advisory: the existing inline disable directives in the source remain valid.
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // SECURITY BOUNDARY (audit 08 P1): a client component must NEVER import a
  // server-only module — those read GROQ / Polar / Supabase service-role secrets.
  // This is the rule the whole lint gate exists for, so it is an ERROR. (Merges on
  // top of the app-source block above for files under components/.)
  {
    files: ["components/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/groq",
                "@/lib/supabaseAdmin",
                "@/lib/polar",
                "@/lib/polarWebhook",
                "**/lib/groq",
                "**/lib/supabaseAdmin",
                "**/lib/polar",
                "**/lib/polarWebhook",
              ],
              message:
                "Server-only module (reads secret keys) — never import it into a client component.",
            },
          ],
        },
      ],
    },
  },

  // Node maintenance scripts (.mjs): node globals only, no React.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: sharedRules,
  },
];
