// Link allowlist (#6): only http, https and mailto hrefs are ever linked.
import { describe, expect, it } from 'vitest';

import { isSafeLinkHref } from '../../src/core/safe-link';

describe('isSafeLinkHref', () => {
  it('allows http', () => {
    expect(isSafeLinkHref('http://a.b')).toBe(true);
  });

  it('allows https in any case', () => {
    expect(isSafeLinkHref('HTTPS://a.b')).toBe(true);
  });

  it('allows mailto', () => {
    expect(isSafeLinkHref('mailto:x@y.z')).toBe(true);
  });

  it('allows surrounding whitespace', () => {
    expect(isSafeLinkHref('  https://a.b ')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    'file:///c:/x',
    'vbscript:x',
    '/x',
    '#x',
    '',
  ])('rejects %j', (href) => {
    expect(isSafeLinkHref(href)).toBe(false);
  });

  it('rejects a scheme hidden behind a control character', () => {
    expect(isSafeLinkHref('java\tscript:alert(1)')).toBe(false);
  });
});
