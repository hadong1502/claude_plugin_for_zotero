// Acceptance tests for the public runtime exports fixed by #2 (interfaces-first
// ticket of #1). They pin import paths, export names and export kinds only;
// behaviour is pinned by the later tickets of #1.
import { describe, expect, it } from 'vitest';

import { ProcessNotFoundError } from '../../src/core/process-port';
import { ClaudeRunner } from '../../src/core/runner';
import { buildQuestion } from '../../src/core/context-builder';
import { ThreadStore } from '../../src/core/thread-store';
import {
  renderAnswerHtml,
  toAnnotationText,
  toNoteHtml,
} from '../../src/core/answer-renderer';
import { PREF_DEFAULTS, PREF_KEYS } from '../../src/core/prefs-schema';

// A value is a class when it is a function whose source is a class declaration.
function isClass(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    /^class[\s{]/.test(Function.prototype.toString.call(value))
  );
}

describe('process port (src/core/process-port)', () => {
  it('exports ProcessNotFoundError as a subclass of Error', () => {
    expect(ProcessNotFoundError.prototype).toBeInstanceOf(Error);
  });
});

describe('Claude Runner (src/core/runner)', () => {
  it('exports ClaudeRunner as a class', () => {
    expect(isClass(ClaudeRunner)).toBe(true);
  });
});

describe('Context Builder (src/core/context-builder)', () => {
  it('exports buildQuestion as a function', () => {
    expect(typeof buildQuestion).toBe('function');
  });
});

describe('Thread Store (src/core/thread-store)', () => {
  it('exports ThreadStore as a class', () => {
    expect(isClass(ThreadStore)).toBe(true);
  });
});

describe('Answer Renderer (src/core/answer-renderer)', () => {
  it('exports renderAnswerHtml as a function', () => {
    expect(typeof renderAnswerHtml).toBe('function');
  });

  it('exports toNoteHtml as a function', () => {
    expect(typeof toNoteHtml).toBe('function');
  });

  it('exports toAnnotationText as a function', () => {
    expect(typeof toAnnotationText).toBe('function');
  });
});

describe('preferences schema (src/core/prefs-schema)', () => {
  // Defaults from #1 "Preferences": empty CLI path means auto-detect, default
  // model sonnet, empty About me, Answer language matches the question.
  it('defaults the four preferences to empty CLI path, sonnet, empty About me and match', () => {
    expect(PREF_DEFAULTS).toEqual({
      cliPath: '',
      defaultModel: 'sonnet',
      aboutMe: '',
      answerLanguage: 'match',
    });
  });

  it('names exactly the cliPath, defaultModel, aboutMe and answerLanguage preference keys', () => {
    expect(Object.keys(PREF_KEYS).sort()).toEqual(
      ['aboutMe', 'answerLanguage', 'cliPath', 'defaultModel'],
    );
  });
});
