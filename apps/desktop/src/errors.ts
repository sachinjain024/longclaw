import type { AppError, ErrorCode } from "./types";

const ERROR_CODES = new Set<ErrorCode>([
  "cancelled",
  "invalid_project",
  "project_unavailable",
  "ticket_not_found",
  "parse_failed",
  "unsupported_version",
  "conflict",
  "permission_denied",
  "io",
  "internal",
]);

function isAppError(error: unknown): error is AppError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Partial<AppError>;
  return (
    typeof candidate.code === "string" &&
    ERROR_CODES.has(candidate.code as ErrorCode) &&
    typeof candidate.message === "string" &&
    typeof candidate.recoverable === "boolean"
  );
}

/**
 * Rust rejects a command with the tagged error shape (ADR 0010). Anything else
 * reaching here is a frontend fault, and it is reported as one rather than being
 * dressed up as an expected failure.
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return {
    code: "internal",
    message: error instanceof Error ? error.message : String(error),
    recoverable: false,
  };
}
