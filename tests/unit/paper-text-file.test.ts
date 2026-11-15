// The paper's text file (#11 manual run, amending #8): the plugin writes the
// PDF attachment's extracted text to `<Zotero data dir>/claude-for-zotero/
// paper-text/<attachment key>.txt` so Claude can Read it without poppler.
// Zotero, PathUtils and IOUtils are the Gecko boundary, so they are faked; the
// attachment is a fake Zotero item.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { itemPaper } from '../../src/modules/claude-pane';
import { paperTextDir } from '../../src/modules/cli-workdir';

const DATA_DIR = 'C:\\Users\\u\\Zotero';
const TEXT_DIR = 'C:\\Users\\u\\Zotero\\claude-for-zotero\\paper-text';
const TEXT_FILE = 'C:\\Users\\u\\Zotero\\claude-for-zotero\\paper-text\\ABCD1234.txt';

let makeDirectory: ReturnType<typeof vi.fn>;
let writeUTF8: ReturnType<typeof vi.fn>;
let logError: ReturnType<typeof vi.fn>;

beforeEach(() => {
  makeDirectory = vi.fn(async () => {});
  writeUTF8 = vi.fn(async () => 0);
  logError = vi.fn();
  vi.stubGlobal('Zotero', { DataDirectory: { dir: DATA_DIR }, logError });
  vi.stubGlobal('PathUtils', { join: (...parts: string[]) => parts.join('\\') });
  vi.stubGlobal('IOUtils', { makeDirectory, writeUTF8 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A PDF attachment whose extracted text is `text` (or whose read rejects). */
function pdfAttachment(text: string | Error): Zotero.Item {
  return {
    key: 'ABCD1234',
    isAttachment: () => true,
    attachmentContentType: 'application/pdf',
    getFilePathAsync: async () => 'C:\\p\\a.pdf',
    get attachmentText() {
      return text instanceof Error ? Promise.reject(text) : Promise.resolve(text);
    },
  } as unknown as Zotero.Item;
}

async function textFileOf(text: string | Error): Promise<string | undefined> {
  const paper = await itemPaper({ reader: pdfAttachment(text) });
  return paper?.textFile?.();
}

describe('paperTextDir', () => {
  it('is <data dir>/claude-for-zotero/paper-text, a sibling of cli-workdir', () => {
    expect(paperTextDir()).toBe(TEXT_DIR);
  });
});

describe("itemPaper's text file", () => {
  it('returns <paper-text dir>/<attachment key>.txt', async () => {
    expect(await textFileOf('Body of the paper.')).toBe(TEXT_FILE);
  });

  it('writes the extracted text there as UTF-8 through a temporary file', async () => {
    await textFileOf('Body of the paper.');
    expect(writeUTF8).toHaveBeenCalledWith(TEXT_FILE, 'Body of the paper.', {
      tmpPath: expect.any(String),
    });
  });

  it('creates the paper-text directory first', async () => {
    await textFileOf('Body of the paper.');
    expect(makeDirectory).toHaveBeenCalledWith(TEXT_DIR, { createAncestors: true, ignoreExisting: true });
  });

  it('writes the full text, untruncated', async () => {
    const long = 'x'.repeat(200000);
    await textFileOf(long);
    expect((writeUTF8.mock.calls[0] as unknown[])[1]).toBe(long);
  });

  it('blank extracted text gives no file and writes nothing', async () => {
    const result = await textFileOf('  \n ');
    expect({ result, writes: writeUTF8.mock.calls.length }).toEqual({ result: undefined, writes: 0 });
  });

  it('a failing text extraction gives no file and is logged', async () => {
    const result = await textFileOf(new Error('PDFWorker failed'));
    expect({ result, logged: logError.mock.calls.length }).toEqual({ result: undefined, logged: 1 });
  });

  it('a failing write gives no file and is logged', async () => {
    writeUTF8.mockRejectedValue(new Error('disk full'));
    const result = await textFileOf('Body of the paper.');
    expect({ result, logged: logError.mock.calls.length }).toEqual({ result: undefined, logged: 1 });
  });

  it('rewrites the file on each use', async () => {
    const paper = await itemPaper({ reader: pdfAttachment('Body.') });
    await paper?.textFile?.();
    await paper?.textFile?.();
    expect(writeUTF8).toHaveBeenCalledTimes(2);
  });
});
