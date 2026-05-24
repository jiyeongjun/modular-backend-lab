export class AppError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
  }
}

export class OptimisticConcurrencyError extends AppError {
  public constructor(message = "Optimistic concurrency conflict") {
    super("OPTIMISTIC_CONCURRENCY_CONFLICT", message);
    this.name = "OptimisticConcurrencyError";
  }
}
