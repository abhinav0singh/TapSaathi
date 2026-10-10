import { describe, expect, it } from "vitest";
import { StaleGenerationError } from "../src/errors.js";

describe("StaleGenerationError", () => {
  it("preserves a distinct runtime name for workflow catch matching", () => {
    const error = new StaleGenerationError();

    expect(error.name).toBe("StaleGenerationError");
    expect(error.code).toBe("STALE_DEMO_GENERATION");
    expect(error.statusCode).toBe(409);
  });
});
