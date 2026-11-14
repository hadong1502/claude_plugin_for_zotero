import { isSafeLinkHref } from './safe-link';

/** Elements removed together with their contents (compared on lower-cased localName). */
const REMOVED_ELEMENTS = new Set(
  [
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta',
    'base', 'form', 'input', 'button', 'textarea', 'select', 'img', 'picture', 'video',
    'audio', 'source', 'track', 'foreignObject', 'template',
  ].map((name) => name.toLowerCase()),
);

/** Attributes removed outright, whatever their value. */
const REMOVED_ATTRIBUTES = new Set([
  'src', 'srcset', 'action', 'formaction', 'srcdoc', 'xlink:href', 'ping',
]);

const UNSAFE_STYLE = /url\s*\(|expression\s*\(|javascript:/i;

function sanitiseElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const unsafe =
      name.startsWith('on') ||
      REMOVED_ATTRIBUTES.has(name) ||
      (name === 'href' && !isSafeLinkHref(attr.value)) ||
      (name === 'style' && UNSAFE_STYLE.test(attr.value));
    if (unsafe) el.removeAttribute(attr.name);
  }
}

/**
 * Parses renderer output as HTML in a detached document and returns it as a
 * fragment owned by `doc`, after stripping anything dangerous (#1, #6).
 */
export function htmlToFragment(doc: Document, html: string): DocumentFragment {
  const Parser = (doc.defaultView as Window & typeof globalThis).DOMParser;
  const parsed = new Parser().parseFromString(html, 'text/html');
  const body = parsed.body;

  // Snapshot first so removals cannot make the traversal skip nodes.
  for (const el of Array.from(body.querySelectorAll('*'))) {
    if (REMOVED_ELEMENTS.has(el.localName.toLowerCase())) {
      el.remove();
    } else {
      sanitiseElement(el);
    }
  }

  const fragment = doc.createDocumentFragment();
  for (const child of Array.from(body.childNodes)) {
    fragment.appendChild(doc.importNode(child, true));
  }
  return fragment;
}
