// Link allowlist (#6): the one function that decides which hrefs may be linked.
import { notImplemented } from './not-implemented';

/** True iff href, trimmed, starts with http://, https:// or mailto: (case-insensitive). */
export function isSafeLinkHref(href: string): boolean {
  void href;
  return notImplemented('isSafeLinkHref', '#6');
}
