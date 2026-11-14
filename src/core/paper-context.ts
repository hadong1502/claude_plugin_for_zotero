// Paper Context rules (#1, #8): when the full paper is sent, and which PDF
// paths Claude may read directly.
import type { PaperContextMode } from './types';

/** Phrases that force the full paper (#1). Matched case-insensitively. */
export const FORCE_PHRASES: readonly string[] = [
  'add context',
  'use the paper',
  'use full paper',
  'read the paper',
];

const FORCE_PATTERNS: readonly RegExp[] = FORCE_PHRASES.map(
  (phrase) => new RegExp(`\\b${phrase.split(' ').join('\\s+')}\\b`, 'i'),
);

/** True when the question contains a force phrase as whole words (#1). */
export function wantsFullPaper(question: string): boolean {
  return FORCE_PATTERNS.some((re) => re.test(question));
}

/** Paper Context mode: none without a PDF, forced by toggle or phrase (#1). */
export function resolvePaperContext(o: {
  useFullPaper: boolean;
  question: string;
  hasPdf: boolean;
}): PaperContextMode {
  if (!o.hasPdf) return 'none';
  return o.useFullPaper || wantsFullPaper(o.question) ? 'forced' : 'claude-decides';
}

// Only this shape of path has a verified Read rule form (ADR); anything else
// falls back to extracted text.
const READABLE_PATH = /^[A-Za-z]:\\[A-Za-z0-9 _.\-()[\]{},#&\\]*$/;

/** True when the absolute Windows path has a verified Read rule form (#8). */
export function canReadPdfPath(path: string): boolean {
  return READABLE_PATH.test(path);
}

/** Read rule path per the ADR: `//c/...` with forward slashes, `[]{}` escaped. */
export function readRulePath(path: string): string {
  if (!canReadPdfPath(path)) throw new Error('readRulePath: unsupported path');
  const rest = path.slice(3).replace(/\\/g, '/').replace(/[[\]{}]/g, '\\$&');
  return `//${path[0].toLowerCase()}/${rest}`;
}
