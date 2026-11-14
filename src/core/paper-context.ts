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

const notImplementedYet = (): never => {
  throw new Error('not implemented (#8)');
};

export function wantsFullPaper(_question: string): boolean {
  return notImplementedYet();
}

export function resolvePaperContext(_o: {
  useFullPaper: boolean;
  question: string;
  hasPdf: boolean;
}): PaperContextMode {
  return notImplementedYet();
}

export function canReadPdfPath(_path: string): boolean {
  return notImplementedYet();
}

export function readRulePath(_path: string): string {
  return notImplementedYet();
}
