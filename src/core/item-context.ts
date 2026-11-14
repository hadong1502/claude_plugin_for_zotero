// Item Context mapping (#4): a Zotero item to the identifying metadata sent
// with every question. Pure: ItemLike stands in for a Zotero item.
import { notImplemented } from './not-implemented';
import type { ItemContext } from './types';

export interface ItemLike {
  getField(name: 'title' | 'date' | 'abstractNote'): string;
  getCreators(): Array<{ firstName?: string; lastName?: string; name?: string }>;
}

export function itemContextFrom(item: ItemLike): ItemContext {
  void item;
  return notImplemented('itemContextFrom', '#4');
}
