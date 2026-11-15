// How the Ask Controller offers the paper's text file alongside the PDF (#11
// manual run, amending #8). The fake runner is a boundary fake for the CLI
// process and the fake PaperSource stands in for Zotero; the Thread Store and
// Context Builder are real.
import { describe, expect, it, vi } from 'vitest';

import { AskController, type PaperSource, type RunnerLike } from '../../src/core/ask-controller';
import { ThreadStore } from '../../src/core/thread-store';
import type { AnswerEvent, ClaudeRequest, ItemContext } from '../../src/core/types';

const KEY = 11;
const ITEM: ItemContext = { title: 'T', creators: ['A'], year: '2017', abstract: 'Abs.' };
const SETTINGS = { aboutMe: 'A student', answerLanguage: 'English' };
const PDF = 'C:\\p\\a.pdf';
const TXT = 'C:\\d\\paper-text\\ABCD1234.txt';
const UNVERIFIED_PDF = 'C:\\Zo\u00eb\\a.pdf';
const UNVERIFIED_TXT = 'C:\\Zo\u00eb\\paper-text\\ABCD1234.txt';
const TXT_DENIED_BY_CLI = 'c:/d/paper-text/abcd1234.TXT';

/** Replays a scripted `deniedReads()` list per run and records each request. */
class FakeRunner implements RunnerLike {
  readonly requests: ClaudeRequest[] = [];
  readonly #denials: string[][];
  #runs = 0;

  constructor(denials: string[][] = []) {
    this.#denials = denials;
  }

  cancel(): void {}

  deniedReads(): string[] {
    return this.#denials[this.#runs - 1] ?? [];
  }

  async *ask(request: ClaudeRequest): AsyncGenerator<AnswerEvent> {
    this.#runs += 1;
    this.requests.push(request);
    yield { type: 'done', text: 'A', sessionId: 's1' };
  }
}

function paperSource(
  pdfPath: string | undefined,
  textFileResult: string | undefined | Error,
  text: string | undefined = 'Full text.',
) {
  const loadText = vi.fn(async () => text);
  const textFile = vi.fn(async () => {
    if (textFileResult instanceof Error) throw textFileResult;
    return textFileResult;
  });
  const paper: PaperSource = { pdfPath, loadText, textFile };
  return { paper, loadText, textFile };
}

function setup(runner = new FakeRunner()) {
  const store = new ThreadStore();
  const controller = new AskController({ store, createRunner: async () => runner, settings: () => SETTINGS });
  return { runner, store, controller };
}

const textOf = (request: ClaudeRequest): string => {
  const first = request.content[0];
  return first.type === 'text' ? first.text : '';
};

describe('AskController with the paper text file', () => {
  it('both files readable: the text file, then the PDF', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper: paperSource(PDF, TXT).paper });
    expect(runner.requests[0].readableFiles).toEqual([TXT, PDF]);
  });

  it('both files readable when forced: the prompt says to read the text first', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(PDF, TXT).paper,
      useFullPaper: true,
    });
    expect(runner.requests[0].systemPrompt).toContain('Read the text file with the Read tool before answering');
  });

  it('text only when the PDF path is unverified, claude-decides', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF, TXT).paper,
    });
    expect(runner.requests[0].readableFiles).toEqual([TXT]);
  });

  it('text only when forced does not load inline text', async () => {
    const { runner, controller } = setup();
    const { paper, loadText } = paperSource(UNVERIFIED_PDF, TXT);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper, useFullPaper: true });
    expect({ files: runner.requests[0].readableFiles, loads: loadText.mock.calls.length }).toEqual({
      files: [TXT],
      loads: 0,
    });
  });

  it('PDF only when there is no text file', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(PDF, undefined).paper,
    });
    expect(runner.requests[0].readableFiles).toEqual([PDF]);
  });

  it('PDF only when writing the text file rejects', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(PDF, new Error('disk full')).paper,
    });
    expect(runner.requests[0].readableFiles).toEqual([PDF]);
  });

  it('PDF only when the text file path is empty', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper: paperSource(PDF, '').paper });
    expect(runner.requests[0].readableFiles).toEqual([PDF]);
  });

  it('PDF only when the text file path is unverified', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(PDF, UNVERIFIED_TXT).paper,
    });
    expect(runner.requests[0].readableFiles).toEqual([PDF]);
  });

  it('neither file readable, forced, falls back to inline text', async () => {
    const { runner, controller } = setup();
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF, UNVERIFIED_TXT).paper,
      useFullPaper: true,
    });
    expect({
      files: runner.requests[0].readableFiles,
      inline: textOf(runner.requests[0]).includes('Paper text (extracted from the PDF):\n"""\nFull text.\n"""'),
    }).toEqual({ files: [], inline: true });
  });

  it('neither file readable, claude-decides, gives none', async () => {
    const { runner, controller } = setup();
    const { paper, loadText } = paperSource(UNVERIFIED_PDF, undefined);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper });
    expect({
      files: runner.requests[0].readableFiles,
      mentionsPaper: runner.requests[0].systemPrompt.includes("The paper's"),
      loads: loadText.mock.calls.length,
    }).toEqual({ files: [], mentionsPaper: false, loads: 0 });
  });

  it('a missing PDF file still means none, so no text file is written', async () => {
    const { runner, controller } = setup();
    const { paper, textFile } = paperSource(undefined, TXT);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper, useFullPaper: true });
    expect({ files: runner.requests[0].readableFiles, writes: textFile.mock.calls.length }).toEqual({
      files: [],
      writes: 0,
    });
  });

  it('a denied text-file read is remembered', async () => {
    const runner = new FakeRunner([[TXT_DENIED_BY_CLI]]);
    const { controller } = setup(runner);
    const { paper } = paperSource(PDF, TXT);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper });
    await controller.ask(KEY, ITEM, 'Again?', 'sonnet', { paper });
    expect(runner.requests[1].readableFiles).toEqual([PDF]);
  });
});

/** A forced ask whose text file never arrives until `settle` is called. */
function pendingTextFile() {
  let settle: (path: string) => void = () => {};
  const textFile = vi.fn(() => new Promise<string | undefined>((resolve) => (settle = resolve)));
  const loadText = vi.fn(async () => 'Full text.');
  const paper: PaperSource = { pdfPath: PDF, loadText, textFile };
  return { paper, textFile, settle: (p: string) => settle(p) };
}

async function writing(controller: AskController, pending: ReturnType<typeof pendingTextFile>) {
  const done = controller.ask(KEY, ITEM, 'Q?', 'sonnet', { useFullPaper: true, paper: pending.paper });
  await vi.waitFor(() => expect(pending.textFile).toHaveBeenCalled());
  return done;
}

describe('AskController Stop and Clear while the text file is written', () => {
  it('Stop while the text file is pending stops the turn at once', async () => {
    const { store, controller } = setup();
    const pending = pendingTextFile();
    const done = writing(controller, pending);
    await vi.waitFor(() => expect(pending.textFile).toHaveBeenCalled());
    controller.stop(KEY);
    await done;
    expect({ status: store.get(KEY).turns[0]?.status, running: controller.isRunning(KEY) }).toEqual({
      status: 'stopped',
      running: false,
    });
  });

  it('Stop while the text file is pending starts no run', async () => {
    const { runner, controller } = setup();
    const pending = pendingTextFile();
    const done = writing(controller, pending);
    await vi.waitFor(() => expect(pending.textFile).toHaveBeenCalled());
    controller.stop(KEY);
    await done;
    pending.settle(TXT);
    await Promise.resolve();
    expect(runner.requests).toEqual([]);
  });

  it('Stop while the text file is pending keeps the held prior exchange', async () => {
    const { store, controller } = setup();
    store.importExchange(KEY, { question: 'Old?', answer: 'Older.', model: 'sonnet' });
    const pending = pendingTextFile();
    const done = writing(controller, pending);
    await vi.waitFor(() => expect(pending.textFile).toHaveBeenCalled());
    controller.stop(KEY);
    await done;
    expect(store.takePriorExchange(KEY)).toEqual({ question: 'Old?', answer: 'Older.' });
  });

  it('Clear while the text file is pending leaves the Thread empty', async () => {
    const { runner, store, controller } = setup();
    const pending = pendingTextFile();
    const done = writing(controller, pending);
    await vi.waitFor(() => expect(pending.textFile).toHaveBeenCalled());
    controller.clear(KEY);
    await done;
    pending.settle(TXT);
    await Promise.resolve();
    expect({ turns: store.get(KEY).turns, requests: runner.requests.length }).toEqual({ turns: [], requests: 0 });
  });
});
