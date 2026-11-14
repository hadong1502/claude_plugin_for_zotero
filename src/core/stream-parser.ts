// Stream-json parser (#4): turns the Claude CLI's stdout (one JSON event per
// line) into the few events the Runner cares about (#1, #4).

export type ParsedEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'assistant-error'; code: string }
  | { kind: 'read-denied'; paths: string[] }
  | { kind: 'result'; isError: boolean; text: string; sessionId?: string; errors: string[] };

export class StreamJsonParser {
  private buffer = '';

  /** Returns the events completed by this chunk, in order. */
  push(chunk: string): ParsedEvent[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines.flatMap((line) => parseLine(line));
  }

  /** Flushes a final line without a trailing newline. */
  end(): ParsedEvent[] {
    const rest = this.buffer;
    this.buffer = '';
    return parseLine(rest);
  }
}

function parseLine(rawLine: string): ParsedEvent[] {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  if (line.trim() === '') return [];
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return [];
  }
  if (typeof json !== 'object' || json === null) return [];
  const event = json as Record<string, any>;

  switch (event.type) {
    case 'system':
      return event.subtype === 'init' && typeof event.session_id === 'string'
        ? [{ kind: 'session', sessionId: event.session_id }]
        : [];
    case 'stream_event': {
      const inner = event.event;
      const delta = inner?.delta;
      return inner?.type === 'content_block_delta' &&
        delta?.type === 'text_delta' &&
        typeof delta.text === 'string'
        ? [{ kind: 'text', text: delta.text }]
        : [];
    }
    case 'assistant':
      return typeof event.error === 'string' ? [{ kind: 'assistant-error', code: event.error }] : [];
    case 'result':
      return [
        {
          kind: 'result',
          isError: event.is_error === true,
          text: typeof event.result === 'string' ? event.result : '',
          ...(typeof event.session_id === 'string' ? { sessionId: event.session_id } : {}),
          errors: Array.isArray(event.errors) ? event.errors.map(String) : [],
        },
      ];
    default:
      return [];
  }
}
