// Library Writer (#1, #9): the only code that writes to the Zotero library,
// and only when a save button is pressed. Thin over Zotero's APIs:
// - a Saved Note is `new Zotero.Item('note')` with `setNote` and `saveTx`;
//   a child of a regular item (`parentID`), or a standalone note in the same
//   library when the Thread belongs to a standalone attachment, since notes
//   cannot be children of attachments in the item tree;
// - a Saved Annotation is a highlight on the Selection through
//   `Zotero.Annotations.saveFromJSON`, with a fresh key; for a card opened
//   from an existing annotation (#14), the Q&A is appended to that
//   annotation's comment instead.
// Errors propagate to the caller, which reports them.
import { appendToComment } from '../core/annotation-question';
import { toAnnotationText, toNoteHtml } from '../core/answer-renderer';
import { highlightJson, saveableTurns, type SelectionAnnotation } from '../core/saving';
import type { Thread, Turn } from '../core/types';

type QA = Pick<Turn, 'question' | 'answer'>;

/** Saves one question and its Answer as a note of `item`. */
export async function saveAnswerNote(item: Zotero.Item, turn: QA): Promise<Zotero.Item> {
  return saveNote(item, toNoteHtml([{ question: turn.question, answer: turn.answer }]));
}

/** Saves a Thread's saveable turns, in order, as one note of `item`. */
export async function saveThreadNote(
  item: Zotero.Item,
  thread: Pick<Thread, 'turns'>,
): Promise<Zotero.Item> {
  const turns = saveableTurns(thread.turns);
  if (turns.length === 0) throw new Error('Claude for Zotero: the Thread has no saved Answers');
  return saveNote(item, toNoteHtml(turns.map(({ question, answer }) => ({ question, answer }))));
}

/** Saves a highlight on the Selection with the question and Answer as its comment. */
export async function saveAnnotation(
  attachment: Zotero.Item,
  selectionAnnotation: SelectionAnnotation,
  question: string,
  answer: string,
): Promise<Zotero.Item> {
  const utilities = (Zotero as unknown as { DataObjectUtilities: { generateKey(): string } })
    .DataObjectUtilities;
  const json = highlightJson(
    selectionAnnotation,
    utilities.generateKey(),
    toAnnotationText(question, answer),
  );
  return Zotero.Annotations.saveFromJSON(
    attachment,
    json as unknown as _ZoteroTypes.Annotations.AnnotationJson,
  );
}

/** Appends the question and Answer to an existing annotation's comment, below what is there (#14). */
export async function addToAnnotation(
  libraryID: number,
  annotationKey: string,
  question: string,
  answer: string,
): Promise<Zotero.Item> {
  const item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, annotationKey);
  if (!item || !item.isAnnotation()) throw new Error('Inline Card: the annotation no longer exists');
  item.annotationComment = appendToComment(item.annotationComment ?? '', toAnnotationText(question, answer));
  await item.saveTx();
  return item;
}

async function saveNote(item: Zotero.Item, html: string): Promise<Zotero.Item> {
  const note = new Zotero.Item('note');
  note.libraryID = item.libraryID;
  if (item.isRegularItem()) note.parentID = item.id;
  note.setNote(html);
  await note.saveTx();
  return note;
}
