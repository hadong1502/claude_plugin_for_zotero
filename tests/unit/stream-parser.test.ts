// Stream-json parser (#4): the Claude CLI's stdout becomes session, text,
// assistant-error and result events (#1, #4). Fixtures are real CLI transcripts
// (#3); expected values come from each fixture's own result line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { StreamJsonParser, type ParsedEvent } from '../../src/core/stream-parser';

const SESSION_ID = 'f61ad1cb-1c52-4f9c-a7eb-793b3dcb3c55';

function fixture(name: string): string {
  return readFileSync(join(__dirname, '../fixtures/cli', `${name}.jsonl`), 'utf8');
}

/** The fixture's own result line: the last line whose type is "result". */
function resultLine(raw: string): { result?: string; session_id: string; is_error: boolean } {
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  const parsed = lines.map((l) => JSON.parse(l) as { type?: string });
  const last = [...parsed].reverse().find((e) => e.type === 'result');
  return last as never;
}

function feedWhole(raw: string): ParsedEvent[] {
  const p = new StreamJsonParser();
  return [...p.push(raw), ...p.end()];
}

function feedChars(raw: string): ParsedEvent[] {
  const p = new StreamJsonParser();
  const out: ParsedEvent[] = [];
  for (const ch of raw) out.push(...p.push(ch));
  out.push(...p.end());
  return out;
}

function textOf(events: ParsedEvent[]): string {
  return events.flatMap((e) => (e.kind === 'text' ? [e.text] : [])).join('');
}

describe('StreamJsonParser', () => {
  it('normal-answer emits one session event with id f61ad1cb-1c52-4f9c-a7eb-793b3dcb3c55', () => {
    const sessions = feedWhole(fixture('normal-answer')).filter((e) => e.kind === 'session');
    expect(sessions).toEqual([{ kind: 'session', sessionId: SESSION_ID }]);
  });

  it("normal-answer text events concatenate to the fixture's result.result", () => {
    const raw = fixture('normal-answer');
    expect(textOf(feedWhole(raw))).toBe(resultLine(raw).result);
  });

  it('normal-answer ends with a result event with isError false and sessionId f61ad1cb-…', () => {
    const events = feedWhole(fixture('normal-answer'));
    const last = events[events.length - 1];
    expect(last).toMatchObject({ kind: 'result', isError: false, sessionId: SESSION_ID });
  });

  it('normal-answer-with-thinking emits no text from thinking deltas', () => {
    const raw = fixture('normal-answer-with-thinking');
    expect(textOf(feedWhole(raw))).toBe(resultLine(raw).result);
  });

  it('feeding a fixture in 1-character chunks yields the same events as feeding it whole', () => {
    const raw = fixture('normal-answer');
    expect(feedChars(raw)).toEqual(feedWhole(raw));
  });

  it('CRLF line endings parse the same as LF', () => {
    const raw = fixture('normal-answer');
    expect(feedWhole(raw.replace(/\n/g, '\r\n'))).toEqual(feedWhole(raw));
  });

  it('events after the result line are ignored except other parsed kinds', () => {
    const events = feedWhole(fixture('read-allowed-and-denied'));
    expect(events.map((e) => e.kind).indexOf('result')).toBe(events.length - 1);
  });

  it('read-allowed-and-denied has exactly one result event', () => {
    const events = feedWhole(fixture('read-allowed-and-denied'));
    expect(events.filter((e) => e.kind === 'result')).toHaveLength(1);
  });

  it('error-not-signed-in yields assistant-error authentication_failed before an isError result', () => {
    const events = feedWhole(fixture('error-not-signed-in'));
    const summary = events
      .filter((e) => e.kind === 'assistant-error' || e.kind === 'result')
      .map((e) => (e.kind === 'assistant-error' ? `error:${e.code}` : `result:${e.kind === 'result' && e.isError}`));
    expect(summary).toEqual(['error:authentication_failed', 'result:true']);
  });

  it('error-model-not-found yields assistant-error model_not_found', () => {
    const events = feedWhole(fixture('error-model-not-found'));
    expect(events).toContainEqual({ kind: 'assistant-error', code: 'model_not_found' });
  });

  it('error-resume-not-found yields no session event', () => {
    const events = feedWhole(fixture('error-resume-not-found'));
    expect(events.filter((e) => e.kind === 'session')).toEqual([]);
  });

  it('error-resume-not-found yields an isError result whose errors[0] starts "No conversation found with session ID"', () => {
    const events = feedWhole(fixture('error-resume-not-found'));
    const result = events.find((e) => e.kind === 'result');
    expect(result).toMatchObject({
      kind: 'result',
      isError: true,
      errors: [expect.stringMatching(/^No conversation found with session ID/)],
    });
  });

  it('a final line without a trailing newline is emitted by end()', () => {
    const raw = fixture('error-resume-not-found').replace(/\r?\n$/, '');
    const p = new StreamJsonParser();
    const pushed = p.push(raw);
    const flushed = p.end();
    expect([pushed.length, flushed.map((e) => e.kind)]).toEqual([0, ['result']]);
  });

  it('garbage and blank lines are ignored', () => {
    expect(new StreamJsonParser().push('not json\n\n')).toEqual([]);
  });
});
