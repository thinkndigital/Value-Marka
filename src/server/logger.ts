import "server-only";

/**
 * Structured JSON logging, not a logging SDK. Cloud Run ingests container
 * stdout/stderr as Cloud Logging entries automatically and promotes a
 * `severity` + `message` field in a JSON line to structured log fields —
 * so this is the real, fully-functional integration for this environment,
 * with no external credentials or dependency required (unlike Sentry,
 * which would need a real DSN this sandbox doesn't have — see
 * IMPLEMENTATION_PLAN.md Phase 10).
 */
type LogSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

type LogFields = Record<string, unknown>;

function emit(severity: LogSeverity, message: string, fields?: LogFields) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (severity === "ERROR" || severity === "CRITICAL") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("DEBUG", message, fields),
  info: (message: string, fields?: LogFields) => emit("INFO", message, fields),
  warn: (message: string, fields?: LogFields) => emit("WARNING", message, fields),
  error: (message: string, fields?: LogFields) => emit("ERROR", message, fields),
};
