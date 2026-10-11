import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "@taapsaathi/contracts";

vi.mock("./api", () => ({
  api: {
    allEvents: vi.fn(),
  },
}));
import {
  OPERATIONS_AUDIT_INTERVAL_MS,
  operationsAuditView,
  refreshOperationsAudit,
  startOperationsAuditPolling,
} from "./useOperationsAudit";

afterEach(() => {
  vi.useRealTimers();
});

describe("operations audit polling", () => {
  it("continues beyond 12 attempts and stops on cleanup", () => {
    vi.useFakeTimers();

    const refresh = vi.fn();

    const stop = startOperationsAuditPolling(
      refresh,
      (callback, interval) =>
        setInterval(callback, interval) as unknown as number,
      (timer) => clearInterval(timer)
    );

    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(OPERATIONS_AUDIT_INTERVAL_MS * 13);

    expect(refresh).toHaveBeenCalledTimes(14);

    stop();

    vi.advanceTimersByTime(OPERATIONS_AUDIT_INTERVAL_MS * 3);

    expect(refresh).toHaveBeenCalledTimes(14);
  });

  it("retries after an unsuccessful refresh", () => {
    vi.useFakeTimers();

    let attempts = 0;
    const refresh = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) throw new Error("Unavailable");
    });

    const safeRefresh = () => {
      try {
        refresh();
      } catch {
        // The hook handles failed requests and retries.
      }
    };

    const stop = startOperationsAuditPolling(
      safeRefresh,
      (callback, interval) =>
        setInterval(callback, interval) as unknown as number,
      (timer) => clearInterval(timer)
    );

    vi.advanceTimersByTime(OPERATIONS_AUDIT_INTERVAL_MS);

    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
  });
});

describe("operations audit view", () => {
  const event: AuditEvent = {
    auditEventId: "audit-1",
    interventionId: "intervention-1",
    eventType: "INTERVENTION_CREATED",
    actorType: "SYSTEM",
    correlationId: "correlation-1",
    workerId: "ravi-001",
    hubId: "hub-delhi-001",
    demoGeneration: 7,
    details: {},
    occurredAt: "2024-05-29T07:30:00.000Z",
  };

  it("recovers after a rejected audit fetch", async () => {
    const publish = vi.fn();

    const failedFetch = vi.fn().mockRejectedValue(
      new Error("Audit endpoint unavailable")
    );

    await refreshOperationsAudit(7, failedFetch, publish);

    expect(publish).toHaveBeenLastCalledWith({
      demoGeneration: 7,
      status: "unavailable",
      events: null,
    });

    const successfulFetch = vi.fn().mockResolvedValue([event]);

    await refreshOperationsAudit(7, successfulFetch, publish);

    expect(publish).toHaveBeenLastCalledWith({
      demoGeneration: 7,
      status: "loaded",
      events: [event],
    });

    expect(failedFetch).toHaveBeenCalledTimes(1);
    expect(successfulFetch).toHaveBeenCalledTimes(1);
  });
  it("distinguishes loading from a legitimate empty history", () => {
    expect(operationsAuditView(null, 7)).toEqual({
      status: "loading",
      events: null,
    });

    expect(
      operationsAuditView(
        { demoGeneration: 7, status: "loaded", events: [] },
        7
      )
    ).toEqual({
      status: "loaded",
      events: [],
    });
  });

  it("does not expose events from an earlier generation", () => {
    expect(
      operationsAuditView(
        { demoGeneration: 7, status: "loaded", events: [event] },
        8
      )
    ).toEqual({
      status: "loading",
      events: null,
    });
  });

  it("distinguishes failed retrieval from zero events", () => {
    expect(
      operationsAuditView(
        { demoGeneration: 7, status: "unavailable", events: null },
        7
      )
    ).toEqual({
      status: "unavailable",
      events: null,
    });
  });
});
