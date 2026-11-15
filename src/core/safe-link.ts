// Link allowlist (#6): the one function that decides which hrefs may be linked.

/** True iff href, trimmed, starts with http://, https:// or mailto: (case-insensitive). */
export function isSafeLinkHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href.trim());
}
