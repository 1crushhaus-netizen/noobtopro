"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { SUBJECTS } from "@/lib/scoring";
import Icon from "@/components/Icon";

// Small status pill on the np-admin-* recipes. Severity high/med -> muted
// danger/improve accents (tokens, theme-stable); everything else neutral grey.
function Badge({ children, tone = "neutral" }) {
  return <span className={`np-admin-badge np-admin-${tone}`}>{children}</span>;
}

function when(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Admin dashboard: curation queue (approve/hide/delete non-public guides),
 * security warnings (prompt-injection / rate-limit events), and user reports.
 * All data + actions go through the authenticated /api/admin/* routes via the
 * `adminApi` helper (which attaches the caller's Supabase bearer token).
 */
export default function AdminDashboard({ adminApi }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  // A11y P2-10: a styled, accessible confirm modal replaces window.confirm for the
  // destructive guide delete (mirrors Dashboard's reset modal: dimmed backdrop, the
  // safe "Cancel" default focused on open, Escape to cancel, focus restored on close).
  // `confirmDelete` holds the pending guide ({ key, concept, subject, concept_key }).
  const [confirmDelete, setConfirmDelete] = useState(null);
  const cancelRef = useRef(null); // default focus = the safe "Cancel" button
  const prevFocusRef = useRef(null); // focus to restore when the dialog closes

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi("/api/admin/data"));
    } catch (e) {
      setError(e.message || "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }, [adminApi]);

  useEffect(() => {
    load();
  }, [load]);

  // A11y P2-10: focus the safe "Cancel" button on open; Escape cancels (unless an
  // action is in flight for this guide); restore focus to the trigger on close.
  useEffect(() => {
    if (!confirmDelete) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && busyKey !== confirmDelete.key) setConfirmDelete(null); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocusRef.current?.focus?.();
    };
  }, [confirmDelete, busyKey]);

  async function act(key, payload) {
    setBusyKey(key);
    setError("");
    try {
      await adminApi("/api/admin/action", payload);
      await load();
    } catch (e) {
      setError(e.message || "The action could not be completed.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="np-card np-pulse np-emptytitle" role="status" aria-live="polite" style={{ textAlign: "center", padding: "40px 24px" }}>
        Loading admin data…
      </div>
    );
  }

  const guides = (data && data.pendingGuides) || [];
  const events = (data && data.events) || [];
  const reports = (data && data.reports) || [];

  return (
    <div className="fade-up">
      <div className="np-pagehead">
        <span className="np-eyebrow--mono">Admin</span>
        <h2 className="np-h2">Curation and security</h2>
        <p className="np-lede">
          Approve concept guides into the public hub, and triage suspicious activity. Actions take effect immediately.
        </p>
      </div>

      {error && (
        <div className="np-error" role="alert" style={{ marginBottom: 16 }}>
          <span>{error}</span>
          <button className="np-ghost" onClick={load}>retry</button>
        </div>
      )}

      <div className="np-stats" style={{ marginBottom: 22 }}>
        <div className="np-card np-statcard"><span className="np-eyebrow">Awaiting approval</span><span className="np-statnum">{guides.length}</span></div>
        <div className="np-card np-statcard"><span className="np-eyebrow">Security warnings</span><span className="np-statnum" style={{ color: events.length ? "var(--danger)" : undefined }}>{events.length}</span></div>
        <div className="np-card np-statcard"><span className="np-eyebrow">Open reports</span><span className="np-statnum">{reports.length}</span></div>
      </div>

      {/* ---- Approval queue ---- */}
      <h3 className="np-charttitle" style={{ marginBottom: 10 }}>Concept approval queue</h3>
      {guides.length === 0 ? (
        <div className="np-card np-admin-empty">Nothing awaiting approval. Auto-grown guides stay hidden until you approve them here.</div>
      ) : (
        guides.map((g) => {
          const key = `g:${g.subject}:${g.concept_key}`;
          const subj = SUBJECTS[g.subject];
          const ready = g.status === "ready";
          return (
            <div key={key} className="np-card np-admin-row">
              <div className="np-admin-rowhead">
                <span style={{ color: subj ? subj.color : "var(--text)", fontFamily: "var(--mono)" }}>{subj ? subj.glyph : "·"}</span>
                <strong>{g.concept}</strong>
                <Badge tone="neutral">{g.topic}</Badge>
                <Badge tone={ready ? "ok" : "warn"}>{g.status}</Badge>
                <Badge tone="neutral">{g.visibility}</Badge>
                <Badge tone="neutral">{g.source}</Badge>
                {g.level_band && <Badge tone="neutral">{g.level_band}</Badge>}
              </div>
              {g.overview && <div className="np-admin-preview">{g.overview}</div>}
              {!ready && <div className="np-admin-hint">Empty stub. Open it in Learn to generate a guide, or delete it.</div>}
              <div className="np-admin-actions">
                <button className="np-btn np-primary" disabled={!ready || busyKey === key} onClick={() => act(key, { target: "guide", action: "approve", subject: g.subject, concept_key: g.concept_key })}>Approve → public</button>
                <button className="np-ghost" disabled={busyKey === key} onClick={() => act(key, { target: "guide", action: "hide", subject: g.subject, concept_key: g.concept_key })}>Hide</button>
                <button
                  className="np-ghost np-ghost--danger"
                  disabled={busyKey === key}
                  onClick={() => {
                    prevFocusRef.current = typeof document !== "undefined" ? document.activeElement : null;
                    setConfirmDelete({ key, concept: g.concept, subject: g.subject, concept_key: g.concept_key });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* ---- Security warnings ---- */}
      <h3 className="np-charttitle" style={{ margin: "26px 0 10px" }}>Security warnings</h3>
      {events.length === 0 ? (
        <div className="np-card np-admin-empty">No open warnings. Prompt-injection attempts and abuse spikes show up here.</div>
      ) : (
        events.map((e) => {
          const key = `e:${e.id}`;
          return (
            <div key={key} className="np-card np-admin-row">
              <div className="np-admin-rowhead">
                <Badge tone={e.severity === "high" ? "danger" : e.severity === "medium" ? "warn" : "neutral"}>{e.kind}</Badge>
                <Badge tone={e.severity === "high" ? "danger" : "neutral"}>{e.severity}</Badge>
                {e.route && <span className="np-admin-meta">{e.route}</span>}
                {e.ip && <span className="np-admin-meta">ip {e.ip}</span>}
                <span className="np-admin-meta">{when(e.created_at)}</span>
              </div>
              {e.concept && <div className="np-admin-meta">concept: {e.concept}</div>}
              {e.sample && <div className="np-admin-preview np-admin-sample">{e.sample}</div>}
              <div className="np-admin-actions">
                <button className="np-ghost" disabled={busyKey === key} onClick={() => act(key, { target: "event", action: "reviewed", id: e.id })}>Mark reviewed</button>
                <button className="np-ghost" disabled={busyKey === key} onClick={() => act(key, { target: "event", action: "dismissed", id: e.id })}>Dismiss</button>
              </div>
            </div>
          );
        })
      )}

      {/* ---- User reports ---- */}
      <h3 className="np-charttitle" style={{ margin: "26px 0 10px" }}>User reports</h3>
      {reports.length === 0 ? (
        <div className="np-card np-admin-empty">No open reports.</div>
      ) : (
        reports.map((r) => {
          const key = `r:${r.id}`;
          const subj = SUBJECTS[r.subject];
          return (
            <div key={key} className="np-card np-admin-row">
              <div className="np-admin-rowhead">
                <span style={{ color: subj ? subj.color : "var(--text)", fontFamily: "var(--mono)" }}>{subj ? subj.glyph : "·"}</span>
                <strong>{r.concept_key}</strong>
                <span className="np-admin-meta">{when(r.created_at)}</span>
              </div>
              {r.reason && <div className="np-admin-preview">{r.reason}</div>}
              <div className="np-admin-actions">
                <button className="np-ghost" disabled={busyKey === key} onClick={() => act(key, { target: "report", action: "reviewed", id: r.id })}>Mark reviewed</button>
                <button className="np-ghost" disabled={busyKey === key} onClick={() => act(key, { target: "report", action: "dismissed", id: r.id })}>Dismiss</button>
              </div>
            </div>
          );
        })
      )}

      {/* A11y P2-10: styled delete-confirm modal (replaces window.confirm). Portaled to
          <body>, dimmed backdrop, role=dialog/aria-modal, safe "Cancel" focused on open,
          Escape to cancel (handled in the effect above). */}
      {confirmDelete &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="np-modal-backdrop"
            onClick={() => { if (busyKey !== confirmDelete.key) setConfirmDelete(null); }}
          >
            <div
              className="np-surface-elevated np-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="np-admindelete-title"
              aria-describedby="np-admindelete-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="np-modal-spark" aria-hidden="true"><Icon name="x" size={22} /></div>
              <h2 id="np-admindelete-title" className="np-h2" style={{ textAlign: "center", margin: "0 0 8px" }}>
                Delete this guide?
              </h2>
              <p id="np-admindelete-desc" className="np-lede" style={{ textAlign: "center", margin: "0 auto 22px" }}>
                This permanently deletes the guide for “{confirmDelete.concept}”. This can&apos;t be undone.
              </p>
              <div className="np-modal-actions">
                <button
                  ref={cancelRef}
                  className="np-btn np-secondary"
                  onClick={() => setConfirmDelete(null)}
                  disabled={busyKey === confirmDelete.key}
                >
                  Cancel
                </button>
                <button
                  className="np-btn np-danger"
                  onClick={async () => {
                    const pending = confirmDelete;
                    await act(pending.key, { target: "guide", action: "delete", subject: pending.subject, concept_key: pending.concept_key });
                    setConfirmDelete(null);
                  }}
                  disabled={busyKey === confirmDelete.key}
                >
                  {busyKey === confirmDelete.key ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
