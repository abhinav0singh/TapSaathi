import { randomUUID } from "node:crypto";
import type { AuditEvent } from "@taapsaathi/contracts";

export function createAudit(input: Omit<AuditEvent, "auditEventId"> & { auditEventId?: string }): AuditEvent {
  return {
    ...input,
    auditEventId: input.auditEventId ?? `audit-${randomUUID()}`,
  };
}
