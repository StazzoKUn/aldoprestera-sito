// Errori applicativi con codice HTTP. I service lanciano questi errori,
// il middleware error-handler li trasforma nella risposta JSON uniforme:
//   { "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "VALIDATION_ERROR", message, details);

export const notFound = (message: string) => new AppError(404, "NOT_FOUND", message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "CONFLICT", message, details);
