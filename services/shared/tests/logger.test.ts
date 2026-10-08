import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "../src/logger.js";

describe("structured logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("redacts callback tokens recursively", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);
    log("INFO", "SecurityTest", { taskToken: "never-log-this", nested: { token: "also-secret" }, interventionId: "int-001" });
    const encoded = String(output.mock.calls[0]?.[0]);
    expect(encoded).not.toContain("never-log-this");
    expect(encoded).not.toContain("also-secret");
    expect(encoded).toContain("[REDACTED]");
    expect(encoded).toContain("int-001");
  });
});
