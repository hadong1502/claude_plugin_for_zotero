// Item Context mapping (#4): a Zotero item to the identifying metadata sent
// with every question. Pure: ItemLike stands in for a Zotero item.
import type { ItemContext } from './types';

export interface ItemLike {
  getField(name: 'title' | 'date' | 'abstractNote'): string;
  getCreators(): Array<{ firstName?: string; lastName?: string; name?: string }>;
}

export function itemContextFrom(item: ItemLike): ItemContext {
  const creators = item
    .getCreators()
    .map((c) => c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim())
    .filter((name) => name !== '');
  const year = /\d{4}/.exec(item.getField('date'))?.[0];
  const abstract = item.getField('abstractNote');
  return {
    title: item.getField('title'),
    creators,
    year,
    abstract: abstract.trim() === '' ? undefined : abstract,
  };
}
