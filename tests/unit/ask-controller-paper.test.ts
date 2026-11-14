// Acceptance tests for how the Ask Controller chooses Paper Context and falls
// back to extracted text (#8, #1). The fake runner is a boundary fake for the
// CLI process and the fake PaperSource stands in for Zotero; the Thread Store
// and Context Builder are real.
import { describe, expect, it, vi } from 'vitest';

import { AskController, type PaperSource, type RunnerLike } from '../../src/core/ask-controller';
import { ThreadStore } from '../../src/core/thread-store';
import type { AnswerEvent, ClaudeRequest, ItemContext } from '../../src/core/types';

const KEY = 8;
const ITEM: ItemContext = {
  title: 'Attention Is All You Need',
  creators: ['Vaswani', 'Shazeer'],
  year: '2017',
  abstract: 'We propose the Transformer.',
};
const SETTINGS = { aboutMe: 'A physics PhD student', answerLanguage: 'English' };
const PDF = 'C:\\p\\a.pdf';
const UNVERIFIED_PDF = 'C:\\Zo\u00eb\\a.pdf';
const DENIED_BY_CLI = 'c:/p/A.PDF';

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
    yield { type: 'started', sessionId: 's1' };
    yield { type: 'delta', text: 'A' };
    yield { type: 'done', text: 'A', sessionId: 's1' };
  }
}

function paperSource(pdfPath: string | undefined, text: string | undefined | Error = 'Full text.') {
  const loadText = vi.fn(async () => {
    if (text instanceof Error) throw text;
    return text;
  });
  const paper: PaperSource = { pdfPath, loadText };
  return { paper, loadText };
}

function setup(runner: FakeRunner) {
  const store = new ThreadStore();
  const controller = new AskController({
    store,
    createRunner: async () => runner,
    settings: () => SETTINGS,
  });
  return { store, controller };
}

const textOf = (request: ClaudeRequest): string => {
  const first = request.content[0];
  return first.type === 'text' ? first.text : '';
};

describe('AskController Paper Context', () => {
  it('a PDF makes claude-decides the default', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper: paperSource(PDF).paper });
    expect(runner.requests[0].readableFiles).toEqual([PDF]);
  });

  it('a PDF makes claude-decides the default in the system prompt', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper: paperSource(PDF).paper });
    expect(runner.requests[0].systemPrompt).toContain('only if the question needs');
  });

  it('the toggle forces reading', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(PDF).paper,
      useFullPaper: true,
    });
    expect(runner.requests[0].systemPrompt).toContain('before answering');
  });

  it('a force phrase forces reading', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'use the paper: what is eq. 3?', 'sonnet', {
      paper: paperSource(PDF).paper,
    });
    expect(runner.requests[0].systemPrompt).toContain('before answering');
  });

  // Characterization: the stub already sends no paper context.
  it('no paper means none', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet');
    expect({ files: runner.requests[0].readableFiles, mentionsPdf: runner.requests[0].systemPrompt.includes('PDF') }).toEqual({
      files: [],
      mentionsPdf: false,
    });
  });

  it('an unverified PDF path falls back to extracted text when forced', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    const { paper, loadText } = paperSource(UNVERIFIED_PDF);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper, useFullPaper: true });
    expect(loadText).toHaveBeenCalledTimes(1);
  });

  it('an unverified PDF path puts the extracted text in the content when forced', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF).paper,
      useFullPaper: true,
    });
    expect(textOf(runner.requests[0])).toContain('Paper text (extracted from the PDF):');
  });

  // Characterization: nothing is loaded or readable yet.
  it('an unverified PDF path does not load text when not forced', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    const { paper, loadText } = paperSource(UNVERIFIED_PDF);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper });
    expect(loadText).not.toHaveBeenCalled();
  });

  // Characterization: the stub never makes a file readable.
  it('an unverified PDF path gives none when not forced', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF).paper,
    });
    expect(runner.requests[0].readableFiles).toEqual([]);
  });

  // Characterization: the stub never adds a paper text block.
  it('empty extracted text gives none', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF, '  ').paper,
      useFullPaper: true,
    });
    expect(textOf(runner.requests[0])).not.toContain('Paper text (extracted from the PDF):');
  });

  it('empty extracted text is still loaded when forced', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    const { paper, loadText } = paperSource(UNVERIFIED_PDF, '  ');
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper, useFullPaper: true });
    expect(loadText).toHaveBeenCalledTimes(1);
  });

  // Characterization for the status part: the stub never loads, so it still asks.
  it('a failing loadText gives none and still asks', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF, new Error('boom')).paper,
      useFullPaper: true,
    });
    expect(runner.requests.length).toBe(1);
  });

  it('a failing loadText ends the turn done', async () => {
    const runner = new FakeRunner();
    const { store, controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', {
      paper: paperSource(UNVERIFIED_PDF, new Error('boom')).paper,
      useFullPaper: true,
    });
    expect(store.get(KEY).turns[0].status).toBe('done');
  });

  it('a failing loadText is attempted when forced', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    const { paper, loadText } = paperSource(UNVERIFIED_PDF, new Error('boom'));
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper, useFullPaper: true });
    expect(loadText).toHaveBeenCalledTimes(1);
  });

  it('a denied PDF read is remembered', async () => {
    const runner = new FakeRunner([[DENIED_BY_CLI]]);
    const { controller } = setup(runner);
    const { paper } = paperSource(PDF, 'Fallback text.');
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper });
    await controller.ask(KEY, ITEM, 'Again?', 'sonnet', { paper, useFullPaper: true });
    expect(textOf(runner.requests[1])).toContain('Paper text (extracted from the PDF):');
  });

  it('a denied PDF read leaves no readable file on the next ask', async () => {
    const runner = new FakeRunner([[DENIED_BY_CLI]]);
    const { controller } = setup(runner);
    const { paper } = paperSource(PDF, 'Fallback text.');
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper });
    await controller.ask(KEY, ITEM, 'Again?', 'sonnet', { paper, useFullPaper: true });
    expect(runner.requests[1].readableFiles).toEqual([]);
  });

  it('the Answer is still shown when the PDF read was denied', async () => {
    const runner = new FakeRunner([[DENIED_BY_CLI]]);
    const { store, controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'What is attention?', 'sonnet', { paper: paperSource(PDF).paper });
    expect(store.get(KEY).turns[0].status).toBe('done');
  });

  // Characterization: the Selection picture already reaches the request.
  it('a Selection picture reaches the request', async () => {
    const runner = new FakeRunner();
    const { controller } = setup(runner);
    await controller.ask(KEY, ITEM, 'Explain', 'sonnet', {
      selection: { text: 'x', imagePng: 'iVBOR' },
    });
    expect(runner.requests[0].content[1]).toEqual({ type: 'image', mediaType: 'image/png', data: 'iVBOR' });
  });
});
