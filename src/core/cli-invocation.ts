// CLI invocation builders (#4). Stubs: implemented in ticket #4, task 2.
import type { ClaudeRequest, ContentBlock } from './types';

export function buildCliArgs(_request: ClaudeRequest): string[] {
  throw new Error('buildCliArgs: not implemented (#4)');
}

export function buildStdinMessage(_content: ContentBlock[]): string {
  throw new Error('buildStdinMessage: not implemented (#4)');
}

export function childEnvironment(_env: Record<string, string>): Record<string, string> {
  throw new Error('childEnvironment: not implemented (#4)');
}
