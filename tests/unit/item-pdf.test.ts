// The item's PDF (#8): which attachment Paper Context reads.
import { describe, expect, it, vi } from 'vitest';

import { findItemPdf } from '../../src/core/item-pdf';

interface Att {
  name: string;
  contentType: string;
}

const pdf = (name: string): Att => ({ name, contentType: 'application/pdf' });
const epub = (name: string): Att => ({ name, contentType: 'application/epub+zip' });
const isPdf = (a: Att) => a.contentType === 'application/pdf';

describe('findItemPdf', () => {
  it("a reader tab gives the reader's PDF", async () => {
    expect(await findItemPdf({ reader: pdf('reader') }, isPdf)).toEqual(pdf('reader'));
  });

  it('a reader tab whose attachment is not a PDF gives none', async () => {
    expect(await findItemPdf({ reader: epub('reader') }, isPdf)).toBeUndefined();
  });

  it('a reader tab without a reader gives none', async () => {
    expect(await findItemPdf<Att>({ reader: null }, isPdf)).toBeUndefined();
  });

  it('a PDF attachment selected directly is the PDF, without looking up the best attachment', async () => {
    const best = vi.fn(async () => pdf('best'));
    expect(await findItemPdf({ selected: pdf('selected'), best }, isPdf)).toEqual(pdf('selected'));
    expect(best).not.toHaveBeenCalled();
  });

  it('a regular item gives its best attachment when that is a PDF', async () => {
    expect(await findItemPdf({ best: async () => pdf('best') }, isPdf)).toEqual(pdf('best'));
  });

  it('a regular item whose best attachment is not a PDF gives none', async () => {
    expect(await findItemPdf({ best: async () => epub('best') }, isPdf)).toBeUndefined();
  });

  it('a regular item without attachments gives none', async () => {
    expect(await findItemPdf<Att>({ best: async () => false }, isPdf)).toBeUndefined();
  });

  it('a selected non-PDF attachment falls back to the best attachment', async () => {
    expect(await findItemPdf({ selected: epub('selected'), best: async () => pdf('best') }, isPdf)).toEqual(
      pdf('best'),
    );
  });

  it('a selected non-PDF attachment with no regular item gives none', async () => {
    expect(await findItemPdf({ selected: epub('selected') }, isPdf)).toBeUndefined();
  });
});
