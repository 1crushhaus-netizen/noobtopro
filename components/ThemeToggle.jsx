"use client";

import React, { useEffect, useState } from "react";
import Icon from "@/components/Icon";

/* 3-way theme switcher (light · system · dark). Dark is the product default —
   the pre-paint script in app/layout.js resolves the saved preference before
   hydration, so this control only has to mirror and update it. The preference
   persists in localStorage("np-theme"); "system" tracks the OS live. */

const STORAGE_KEY = "np-theme";
const OPTIONS = [
  { id: "light", icon: "sun", label: "Light theme" },
  { id: "system", icon: "monitor", label: "Match system theme" },
  { id: "dark", icon: "moon", label: "Dark theme" },
];

function resolve(pref) {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function apply(pref) {
  document.documentElement.setAttribute("data-theme", resolve(pref));
}

export default function ThemeToggle() {
  // Render the default (dark) on the server; sync to the saved preference after
  // mount so SSR markup never mismatches.
  const [pref, setPref] = useState("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") setPref(saved);
    } catch {
      /* storage unavailable (private mode) — stay on the default */
    }
  }, []);

  // Keep <html data-theme> in step with the preference, and track OS changes
  // live while "system" is selected.
  useEffect(() => {
    apply(pref);
    if (pref !== "system") return undefined;
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: light)");
    } catch {
      return undefined;
    }
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  function choose(id) {
    setPref(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable — the choice still applies for this session */
    }
  }

  return (
    <div className="np-theme" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={pref === o.id}
          aria-label={o.label}
          title={o.label}
          className={"np-theme-btn" + (pref === o.id ? " active" : "")}
          onClick={() => choose(o.id)}
        >
          <Icon name={o.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
