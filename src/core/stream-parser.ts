// Stream-json parser (#4): turns the Claude CLI's stdout (one JSON event per
// line) into the few events the Runner cares about. Stub: implemented in #4.

export type ParsedEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'assistant-error'; code: string }
  | { kind: 'result'; isError: boolean; text: string; sessionId?: string; errors: string[] };

export class StreamJsonParser {
  /** Returns the events completed by this chunk, in order. */
  push(_chunk: string): ParsedEvent[] {
    throw new Error('StreamJsonParser: not implemented (#4)');
  }

  /** Flushes a final line without a trailing newline. */
  end(): ParsedEvent[] {
    throw new Error('StreamJsonParser: not implemented (#4)');
  }
}
