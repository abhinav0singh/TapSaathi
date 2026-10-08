const REDACTED_KEYS = new Set(["taskToken", "token", "authorization", "Authorization"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      REDACTED_KEYS.has(key) ? "[REDACTED]" : redact(nested),
    ]));
  }
  return value;
}

export function log(
  level: "INFO" | "WARN" | "ERROR",
  operation: string,
  fields: Record<string, unknown>,
): void {
  const entry = redact({ level, operation, ...fields, timestamp: new Date().toISOString() });
  const encoded = JSON.stringify(entry);
  if (level === "ERROR") console.error(encoded);
  else if (level === "WARN") console.warn(encoded);
  else console.info(encoded);
}

export function metric(name: string, value: number, dimensions: Record<string, string>): void {
  console.info(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: "TaapSaathi",
        Dimensions: [Object.keys(dimensions)],
        Metrics: [{ Name: name, Unit: "Count" }],
      }],
    },
    ...dimensions,
    [name]: value,
  }));
}
