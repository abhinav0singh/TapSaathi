export class AppError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConflictError extends AppError {
  public constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class StaleGenerationError extends ConflictError {
  public constructor() {
    super("STALE_DEMO_GENERATION", "This operation belongs to an earlier demo generation.");
  }
}
