// Failure classification and error copy (#4). Turns CLI failure evidence into
// an error kind and plain-language messages.
import type { ErrorKind } from './types';

export interface FailureEvidence {
  assistantErrorCode?: string;
  resultText?: string;
  resultErrors: string[];
  stderr: string;
  exitCode: number | null;
}

const NOT_SIGNED_IN_TEXT = /not logged in|please run \/login/i;
// UNVERIFIED (#4): the spike never observed a real rate-limit failure, so
// these patterns are guesses.
const RATE_LIMIT_TEXT = /rate limit|usage limit|\b429\b/i;

export function classifyFailure(e: FailureEvidence): {
  kind: Exclude<ErrorKind, 'cli-not-found' | 'cancelled'>;
  message: string;
} {
  const code = e.assistantErrorCode ?? '';
  const text = e.resultText ?? '';

  if (code === 'authentication_failed' || NOT_SIGNED_IN_TEXT.test(text)) {
    return { kind: 'not-signed-in', message: errorCopy('not-signed-in', '') };
  }

  if (
    code.includes('rate_limit') ||
    RATE_LIMIT_TEXT.test(text) ||
    RATE_LIMIT_TEXT.test(e.stderr) ||
    e.resultErrors.some((s) => RATE_LIMIT_TEXT.test(s))
  ) {
    return { kind: 'rate-limited', message: errorCopy('rate-limited', '') };
  }

  const stderrFirstLine = e.stderr.trim().split('\n')[0]?.trim() ?? '';
  const message =
    e.resultErrors.join('; ') ||
    text ||
    stderrFirstLine ||
    `Claude CLI exited with code ${e.exitCode}`;
  return { kind: 'failed', message };
}

export function errorCopy(kind: ErrorKind, detail: string): string {
  switch (kind) {
    case 'cli-not-found':
      return 'Claude Code CLI not found. Install Claude Code, or set its path in Settings → Claude.';
    case 'not-signed-in':
      return 'Claude Code is not signed in. Run `claude` in a terminal and sign in, then ask again.';
    case 'rate-limited':
      return "You've reached your Claude usage limit. Try again later.";
    case 'cancelled':
      return 'Stopped.';
    case 'failed':
      return `Claude couldn't answer: ${detail}`;
  }
}
