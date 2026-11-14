// Acceptance tests for the Item Context mapping (#4). The fake ItemLike stands
// in for a Zotero item, a system boundary.
import { describe, expect, it } from 'vitest';

import { itemContextFrom, type ItemLike } from '../../src/core/item-context';

function fakeItem(fields: { title: string; date: string; abstractNote: string }): ItemLike {
  return {
    getField: (name) => fields[name],
    getCreators: () => [{ name: 'OpenAI' }, { firstName: 'Ada', lastName: 'Lovelace' }],
  };
}

describe('itemContextFrom', () => {
  it('maps title, creators, year and abstract', () => {
    const ctx = itemContextFrom(
      fakeItem({ title: 'A Paper', date: '2017-06-12', abstractNote: 'An abstract.' }),
    );
    expect(ctx).toEqual({
      title: 'A Paper',
      creators: ['OpenAI', 'Ada Lovelace'],
      year: '2017',
      abstract: 'An abstract.',
    });
  });

  it('leaves year undefined for an undated item', () => {
    const ctx = itemContextFrom(fakeItem({ title: 'A Paper', date: '', abstractNote: '' }));
    expect(ctx.year).toBeUndefined();
  });
});
