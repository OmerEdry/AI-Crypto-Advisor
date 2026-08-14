// ARCHITECTURE.md §11: these never reach a log line, at any nesting depth.
const REDACTED_KEYS = ['password', 'passwordhash', 'authorization', 'cookie', 'token'];
const REDACTED = '[redacted]';

type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

function isRecord(value: unknown): value is LogContext {
  return typeof value === 'object' && value !== null;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (isRecord(value)) {
    return redactContext(value);
  }

  return value;
}

function redactContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) =>
      REDACTED_KEYS.includes(key.toLowerCase()) ? [key, REDACTED] : [key, redactValue(value)],
    ),
  );
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? redactContext(context) : {}),
  };

  // The one place in the codebase that writes to stdout directly; everything else uses this
  // module, which is what the no-console lint rule enforces.
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
  info: (message: string, context?: LogContext): void => write('info', message, context),
  warn: (message: string, context?: LogContext): void => write('warn', message, context),
  error: (message: string, context?: LogContext): void => write('error', message, context),
};
