// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import AdminDashboard from "@/components/AdminDashboard";

afterEach(cleanup);

// A ready (but hidden) guide, a pending stub, one security event, one report.
const fullData = {
  counts: { guides: 2, events: 1, reports: 1 },
  pendingGuides: [
    {
      subject: "math",
      concept_key: "removable-discontinuities",
      concept: "Removable discontinuities",
      topic: "Limits",
      status: "ready",
      visibility: "hidden",
      source: "auto",
      overview: "A hole you can patch by redefining one point.",
    },
    {
      subject: "physics",
      concept_key: "energy-transformation",
      concept: "Energy transformation",
      topic: "Energy",
      status: "stub",
      visibility: "hidden",
      source: "auto",
      overview: "",
    },
  ],
  events: [
    {
      id: "evt-1",
      kind: "prompt-injection",
      severity: "high",
      route: "/api/generate",
      ip: "203.0.113.9",
      sample: "ignore all previous instructions",
      created_at: "2026-06-01T12:00:00Z",
    },
  ],
  reports: [
    {
      id: "rep-1",
      subject: "chemistry",
      concept_key: "stoichiometry",
      reason: "The guide has a wrong formula.",
      created_at: "2026-06-02T09:30:00Z",
    },
  ],
};

const emptyData = { counts: {}, pendingGuides: [], events: [], reports: [] };

// adminApi(path, payload?) — resolves to the data object on the /data path,
// and to a generic ok on the /action path.
function makeApi(dataObj = fullData) {
  return vi.fn(async (path) => {
    if (path === "/api/admin/data") return dataObj;
    return { ok: true };
  });
}

describe("AdminDashboard", () => {
  it("renders all three sections from canned data", async () => {
    const adminApi = makeApi();
    render(<AdminDashboard adminApi={adminApi} />);

    // initial load is async — wait for the ready guide to appear
    expect(await screen.findByText("Removable discontinuities")).toBeTruthy();
    // the pending stub guide
    expect(screen.getByText("Energy transformation")).toBeTruthy();
    // the security event's kind
    expect(screen.getByText("prompt-injection")).toBeTruthy();
    // the report (rendered by concept_key + reason)
    expect(screen.getByText("stoichiometry")).toBeTruthy();
    expect(screen.getByText(/wrong formula/i)).toBeTruthy();
  });

  it("disables Approve for a pending (status!=='ready') guide and enables it for a ready one", async () => {
    const adminApi = makeApi();
    render(<AdminDashboard adminApi={adminApi} />);
    await screen.findByText("Removable discontinuities");

    const approveButtons = screen.getAllByRole("button", { name: /approve → public/i });
    // Two guides -> two approve buttons, in array order matching pendingGuides.
    expect(approveButtons).toHaveLength(2);
    // First guide is ready -> enabled.
    expect(approveButtons[0].disabled).toBe(false);
    // Second guide is a stub -> disabled.
    expect(approveButtons[1].disabled).toBe(true);
  });

  it("Approve → public calls the action endpoint with the right payload and refetches", async () => {
    const adminApi = makeApi();
    render(<AdminDashboard adminApi={adminApi} />);
    await screen.findByText("Removable discontinuities");

    // initial load = 1 call
    expect(adminApi).toHaveBeenCalledTimes(1);

    const approveButtons = screen.getAllByRole("button", { name: /approve → public/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(adminApi).toHaveBeenCalledWith("/api/admin/action", {
        target: "guide",
        action: "approve",
        subject: "math",
        concept_key: "removable-discontinuities",
      });
    });

    // After the action, the component re-calls /api/admin/data to refresh.
    await waitFor(() => {
      const dataCalls = adminApi.mock.calls.filter((c) => c[0] === "/api/admin/data");
      expect(dataCalls.length).toBe(2);
    });
  });

  it("an event's Dismiss calls the action endpoint with target=event, action=dismissed, id", async () => {
    const adminApi = makeApi();
    render(<AdminDashboard adminApi={adminApi} />);
    await screen.findByText("prompt-injection");

    // The first "Dismiss" button belongs to the lone security event.
    const dismissButtons = screen.getAllByRole("button", { name: /^dismiss$/i });
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(adminApi).toHaveBeenCalledWith("/api/admin/action", {
        target: "event",
        action: "dismissed",
        id: "evt-1",
      });
    });
  });

  it("Delete confirms via window.confirm then calls the action endpoint", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const adminApi = makeApi();
    render(<AdminDashboard adminApi={adminApi} />);
    await screen.findByText("Removable discontinuities");

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(adminApi).toHaveBeenCalledWith("/api/admin/action", {
        target: "guide",
        action: "delete",
        subject: "math",
        concept_key: "removable-discontinuities",
      });
    });
    confirmSpy.mockRestore();
  });

  it("shows the empty states when every section is empty", async () => {
    const adminApi = makeApi(emptyData);
    render(<AdminDashboard adminApi={adminApi} />);

    expect(await screen.findByText(/nothing awaiting approval/i)).toBeTruthy();
    expect(screen.getByText(/no open warnings/i)).toBeTruthy();
    expect(screen.getByText(/no open reports/i)).toBeTruthy();
  });

  it("renders an error with a retry affordance when the initial load rejects", async () => {
    // First /data call rejects; retry succeeds with real data.
    let calls = 0;
    const adminApi = vi.fn(async (path) => {
      if (path === "/api/admin/data") {
        calls += 1;
        if (calls === 1) throw new Error("boom");
        return fullData;
      }
      return { ok: true };
    });
    render(<AdminDashboard adminApi={adminApi} />);

    // Error surfaces in an alert region with a retry button.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/boom/i);
    const retry = screen.getByRole("button", { name: /retry/i });

    fireEvent.click(retry);
    // Retry refetches and the dashboard content now renders.
    expect(await screen.findByText("Removable discontinuities")).toBeTruthy();
  });
});
