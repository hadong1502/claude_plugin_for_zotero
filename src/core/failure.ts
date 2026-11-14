// Failure classification and error copy (#4). Stub: implemented in #4 task 3.
import type { ErrorKind } from './types';

export interface FailureEvidence {
  assistantErrorCode?: string;
  resultText?: string;
  resultErrors: string[];
  stderr: string;
  exitCode: number | null;
}

export function classifyFailure(e: FailureEvidence): {
  kind: Exclude<ErrorKind, 'cli-not-found' | 'cancelled'>;
  message: string;
} {
  void e;
  throw new Error('classifyFailure not implemented (#4)');
}

export function errorCopy(kind: ErrorKind, detail: string): string {
  void kind;
  void detail;
  throw new Error('errorCopy not implemented (#4)');
}
