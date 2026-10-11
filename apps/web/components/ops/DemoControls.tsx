"use client";

import { useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIdentity } from "@/components/useIdentity";
import { api } from "@/lib/api";
import type { DashboardResponse } from "@taapsaathi/contracts";
import { canUseDemoControls, demoControlErrorMessage, isDemoNotReady, planHeatSpike } from "@/lib/demoControls";

type Notice = { tone: "ok" | "error"; text: string };

/**
 * Reset and heat-spike controls for the shared sandbox. Only a signed-in operator or supervisor
 * sees them; the API checks the role again, so a hidden button is never the only protection.
 */
export default function DemoControls({ dashboard, onChanged }: { dashboard: DashboardResponse | null; onChanged: () => void }) {
  const identity = useIdentity();
  const [pending, setPending] = useState<"spike" | "reset" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  if (identity.status !== "signed-in" || !canUseDemoControls(identity.identity.groups)) return null;

  /**
   * One click starts the spike. If Ravi is not in the opening state the demo is reset first, so the
   * operator never has to know about exposure minutes. It does not reset underneath a running alert.
   */
  async function startSpike() {
    if (pending) return;
    setNotice(null);
    const plan = dashboard ? planHeatSpike(dashboard) : ({ kind: "start" } as const);
    if (plan.kind === "blocked") {
      setNotice({ tone: "error", text: plan.reason });
      return;
    }
    setPending("spike");
    let didReset = false;
    try {
      if (plan.kind === "reset-then-start") {
        await api.reset();
        didReset = true;
      }
      try {
        await api.heatSpike();
      } catch (error) {
        // The page's picture of the demo can be a few seconds old. If the server says Ravi was not
        // ready after all, reset once and try again instead of making the operator do it.
        if (didReset || !isDemoNotReady(error)) throw error;
        await api.reset();
        didReset = true;
        await api.heatSpike();
      }
      setNotice({
        tone: "ok",
        text: didReset
          ? "The demo was reset first so Ravi was ready, then the heat spike started. His guidance should appear within a few seconds."
          : "Heat spike started. Ravi's guidance should appear within a few seconds.",
      });
      onChanged();
    } catch (error) {
      if (didReset) onChanged();
      setNotice({ tone: "error", text: demoControlErrorMessage("start a heat spike", error) });
    } finally {
      setPending(null);
    }
  }

  async function resetDemo() {
    if (pending) return;
    setConfirmReset(false);
    setPending("reset");
    setNotice(null);
    try {
      await api.reset();
      setNotice({ tone: "ok", text: "Demo reset. Every rider is back to the opening state." });
      onChanged();
    } catch (error) {
      setNotice({ tone: "error", text: demoControlErrorMessage("reset the demo", error) });
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-label="Sandbox controls" className="mt-5 rounded-2xl bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-[1.0625rem] font-medium">Sandbox controls</h2>
          <p className="mt-1 text-[0.875rem] leading-relaxed text-label-2">
            These change the shared demo for everyone. They start the real AWS workflow with simulated data. Start heat spike resets the demo first when Ravi is not ready, so it works every time.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="lg" disabled={pending !== null} onClick={() => setConfirmReset(true)}>
            {pending === "reset" ? "Resetting…" : "Reset demo"}
          </Button>
          <Button size="lg" disabled={pending !== null} onClick={() => void startSpike()}>
            {pending === "spike" ? "Starting…" : "Start heat spike"}
          </Button>
        </div>
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "mt-4 flex items-start gap-2.5 rounded-xl bg-critical-tint px-3.5 py-3 text-[0.9375rem] text-critical-ink"
              : "mt-4 flex items-start gap-2.5 rounded-xl bg-safe-tint px-3.5 py-3 text-[0.9375rem] text-safe-ink"
          }
        >
          {notice.tone === "error" ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
          <span>{notice.text}</span>
        </p>
      )}

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
            <DialogDescription>
              This clears every alert and puts all riders back to their opening state, with delivery-001 back on Ravi. It affects everyone using the shared demo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button onClick={() => void resetDemo()}>Reset demo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
