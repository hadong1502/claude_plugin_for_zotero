// Which attachment is "the item's PDF" (#8): the file Paper Context reads.

/** Where to look for the item's PDF; `A` is an attachment. */
export type ItemPdfLookup<A> =
  /** A reader tab: only its own attachment counts (null when the reader is gone). */
  | { reader: A | null | undefined }
  | {
      /** The attachment selected directly in the library, if one is. */
      selected?: A;
      /** The regular item's best attachment (getBestAttachment); called only when needed. */
      best?: () => Promise<A | false | null | undefined>;
    };

/**
 * The item's PDF: in a reader tab, the reader's attachment; in the library, a
 * PDF attachment selected directly, or else the regular item's best
 * attachment. Each counts only if `isPdf` holds; otherwise there is none.
 */
export async function findItemPdf<A>(
  lookup: ItemPdfLookup<A>,
  isPdf: (attachment: A) => boolean,
): Promise<A | undefined> {
  const pdf = (attachment: A | false | null | undefined): A | undefined =>
    attachment && isPdf(attachment) ? attachment : undefined;
  if ('reader' in lookup) return pdf(lookup.reader);
  return pdf(lookup.selected) ?? pdf(await lookup.best?.());
}
