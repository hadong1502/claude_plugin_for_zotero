/**
 * Placeholder body for interfaces fixed by #2 whose behaviour lands in a later
 * ticket of #1. Throws so an accidental call fails loudly.
 */
export function notImplemented(what: string, ticket: string): never {
  throw new Error(`${what}: not implemented (${ticket})`);
}
