// Type-level acceptance tests for the shared types and public signatures fixed
// by #2 (interfaces-first ticket of #1). Run by `vitest --typecheck`.
//
// Each test names its subject through an inline `import('...')` type. When the
// module or export is missing, TypeScript reports the error on that line, so
// the failure lands on the test itself. (A top-level import of a missing module
// yields an error type that silently satisfies `toEqualTypeOf`.) The top-level
// imports below are only used to spell the expected shapes.
import { describe, expectTypeOf, it } from 'vitest';

import type {
  AnswerEvent,
  BuiltQuestion,
  ClaudeRequest,
  ContentBlock,
  ErrorKind,
  ItemContext,
  ModelAlias,
  PaperContextMode,
  QuestionInput,
  QuickAction,
  SelectionContext,
  Thread,
  ThreadKey,
  Turn,
  TurnStatus,
} from '../../src/core/types';
import type { ProcessPort, RunningProcess } from '../../src/core/process-port';

describe('shared types (src/core/types)', () => {
  it('ModelAlias is haiku, sonnet or opus', () => {
    type Subject = import('../../src/core/types').ModelAlias;
    expectTypeOf<Subject>().toEqualTypeOf<'haiku' | 'sonnet' | 'opus'>();
  });

  // Error kinds from #1 "Claude Runner".
  it('ErrorKind is one of the five error kinds', () => {
    type Subject = import('../../src/core/types').ErrorKind;
    expectTypeOf<Subject>().toEqualTypeOf<
      'cli-not-found' | 'not-signed-in' | 'rate-limited' | 'cancelled' | 'failed'
    >();
  });

  it('AnswerEvent is the started, delta, done or error event', () => {
    type Subject = import('../../src/core/types').AnswerEvent;
    expectTypeOf<Subject>().toEqualTypeOf<
      | { type: 'started'; sessionId: string }
      | { type: 'delta'; text: string }
      | { type: 'done'; text: string; sessionId: string }
      | { type: 'error'; kind: ErrorKind; message: string }
    >();
  });

  it('ContentBlock is a text block or a base64 PNG image block', () => {
    type Subject = import('../../src/core/types').ContentBlock;
    expectTypeOf<Subject>().toEqualTypeOf<
      | { type: 'text'; text: string }
      | { type: 'image'; mediaType: 'image/png'; data: string }
    >();
  });

  it('ClaudeRequest carries content, model, system prompt, optional resume id and readable files', () => {
    type Subject = import('../../src/core/types').ClaudeRequest;
    expectTypeOf<Subject>().toEqualTypeOf<{
      content: ContentBlock[];
      model: ModelAlias;
      systemPrompt: string;
      resumeSessionId?: string;
      readableFiles: string[];
    }>();
  });

  it('PaperContextMode is none, claude-decides or forced', () => {
    type Subject = import('../../src/core/types').PaperContextMode;
    expectTypeOf<Subject>().toEqualTypeOf<'none' | 'claude-decides' | 'forced'>();
  });

  it('QuickAction is explain, define or explain-math', () => {
    type Subject = import('../../src/core/types').QuickAction;
    expectTypeOf<Subject>().toEqualTypeOf<'explain' | 'define' | 'explain-math'>();
  });

  it('ItemContext carries title, creators, optional year and optional abstract', () => {
    type Subject = import('../../src/core/types').ItemContext;
    expectTypeOf<Subject>().toEqualTypeOf<{
      title: string;
      creators: string[];
      year?: string;
      abstract?: string;
    }>();
  });

  it('SelectionContext carries text, optional page label and optional PNG', () => {
    type Subject = import('../../src/core/types').SelectionContext;
    expectTypeOf<Subject>().toEqualTypeOf<{
      text: string;
      pageLabel?: string;
      imagePng?: string;
    }>();
  });

  it('QuestionInput carries the item, question and every context option', () => {
    type Subject = import('../../src/core/types').QuestionInput;
    expectTypeOf<Subject>().toEqualTypeOf<{
      item: ItemContext;
      question: string;
      quickAction?: QuickAction;
      selection?: SelectionContext;
      paperContext: PaperContextMode;
      pdfPath?: string;
      extractedText?: string;
      aboutMe: string;
      answerLanguage: string;
      priorExchange?: { question: string; answer: string };
    }>();
  });

  it('BuiltQuestion carries system prompt, content and readable files', () => {
    type Subject = import('../../src/core/types').BuiltQuestion;
    expectTypeOf<Subject>().toEqualTypeOf<{
      systemPrompt: string;
      content: ContentBlock[];
      readableFiles: string[];
    }>();
  });

  it('ThreadKey is a numeric Zotero item ID', () => {
    type Subject = import('../../src/core/types').ThreadKey;
    expectTypeOf<Subject>().toEqualTypeOf<number>();
  });

  it('TurnStatus is streaming, done, stopped or error', () => {
    type Subject = import('../../src/core/types').TurnStatus;
    expectTypeOf<Subject>().toEqualTypeOf<'streaming' | 'done' | 'stopped' | 'error'>();
  });

  it('Turn carries id, question, answer, model, status, source and optional error', () => {
    type Subject = import('../../src/core/types').Turn;
    expectTypeOf<Subject>().toEqualTypeOf<{
      id: string;
      question: string;
      answer: string;
      model: ModelAlias;
      status: TurnStatus;
      source: 'pane' | 'inline';
      error?: { kind: ErrorKind; message: string };
    }>();
  });

  it('Thread carries key, optional session id and turns', () => {
    type Subject = import('../../src/core/types').Thread;
    expectTypeOf<Subject>().toEqualTypeOf<{
      key: ThreadKey;
      sessionId?: string;
      turns: Turn[];
    }>();
  });
});

describe('Process Port (src/core/process-port)', () => {
  it('ProcessPort has only spawn', () => {
    type Subject = keyof import('../../src/core/process-port').ProcessPort;
    expectTypeOf<Subject>().toEqualTypeOf<'spawn'>();
  });

  it('ProcessPort.spawn takes command, args and workdir and resolves a RunningProcess', () => {
    type Subject = import('../../src/core/process-port').ProcessPort['spawn'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (opts: { command: string; args: string[]; workdir: string }) => Promise<RunningProcess>
    >();
  });

  it('RunningProcess has exactly the stdin, stdout, stderr, kill and wait members', () => {
    type Subject = keyof import('../../src/core/process-port').RunningProcess;
    expectTypeOf<Subject>().toEqualTypeOf<
      'writeStdin' | 'closeStdin' | 'readStdout' | 'readStderr' | 'kill' | 'wait'
    >();
  });

  it('RunningProcess.writeStdin takes text and resolves void', () => {
    type Subject = import('../../src/core/process-port').RunningProcess['writeStdin'];
    expectTypeOf<Subject>().toEqualTypeOf<(text: string) => Promise<void>>();
  });

  it('RunningProcess.closeStdin resolves void', () => {
    type Subject = import('../../src/core/process-port').RunningProcess['closeStdin'];
    expectTypeOf<Subject>().toEqualTypeOf<() => Promise<void>>();
  });

  it('RunningProcess.readStdout resolves a string chunk', () => {
    type Subject = import('../../src/core/process-port').RunningProcess['readStdout'];
    expectTypeOf<Subject>().toEqualTypeOf<() => Promise<string>>();
  });

  it('RunningProcess.readStderr resolves a string chunk', () => {
    type Subject = import('../../src/core/process-port').RunningProcess['readStderr'];
    expectTypeOf<Subject>().toEqualTypeOf<() => Promise<string>>();
  });

  it('RunningProcess.kill returns void', () => {
    type Subject = import('../../src/core/process-port').RunningProcess['kill'];
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });

  it('RunningProcess.wait resolves the exit code', () => {
    type Subject = import('../../src/core/process-port').RunningProcess['wait'];
    expectTypeOf<Subject>().toEqualTypeOf<() => Promise<{ exitCode: number }>>();
  });
});

describe('Claude Runner (src/core/runner)', () => {
  it('ClaudeRunner is constructed from a process port and a CLI path and workdir config', () => {
    type Subject = ConstructorParameters<typeof import('../../src/core/runner').ClaudeRunner>;
    expectTypeOf<Subject>().toEqualTypeOf<
      [port: ProcessPort, config: { cliPath: string; workdir: string }]
    >();
  });

  it('ClaudeRunner.ask takes a request and returns an async iterable of Answer events', () => {
    type Subject = import('../../src/core/runner').ClaudeRunner['ask'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (request: ClaudeRequest) => AsyncIterable<AnswerEvent>
    >();
  });

  it('ClaudeRunner.cancel takes nothing and returns void', () => {
    type Subject = import('../../src/core/runner').ClaudeRunner['cancel'];
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });
});

describe('Context Builder (src/core/context-builder)', () => {
  it('buildQuestion turns a QuestionInput into a BuiltQuestion', () => {
    type Subject = typeof import('../../src/core/context-builder').buildQuestion;
    expectTypeOf<Subject>().toEqualTypeOf<(input: QuestionInput) => BuiltQuestion>();
  });
});

describe('Thread Store (src/core/thread-store)', () => {
  it('ThreadStore.get takes a key and returns its Thread', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['get'];
    expectTypeOf<Subject>().toEqualTypeOf<(key: ThreadKey) => Thread>();
  });

  it('ThreadStore.appendQuestion takes key, question, model and source and returns the turn id', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['appendQuestion'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (key: ThreadKey, question: string, model: ModelAlias, source: 'pane' | 'inline') => string
    >();
  });

  it('ThreadStore.appendDelta takes key, turn id and text', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['appendDelta'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (key: ThreadKey, turnId: string, text: string) => void
    >();
  });

  it('ThreadStore.finish takes key, turn id and session id', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['finish'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (key: ThreadKey, turnId: string, sessionId: string) => void
    >();
  });

  it('ThreadStore.stop takes key and turn id', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['stop'];
    expectTypeOf<Subject>().toEqualTypeOf<(key: ThreadKey, turnId: string) => void>();
  });

  it('ThreadStore.fail takes key, turn id, error kind and message', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['fail'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (key: ThreadKey, turnId: string, kind: ErrorKind, message: string) => void
    >();
  });

  it('ThreadStore.clear takes a key', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['clear'];
    expectTypeOf<Subject>().toEqualTypeOf<(key: ThreadKey) => void>();
  });

  it('ThreadStore.importExchange takes a key and an inline exchange', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['importExchange'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (
        key: ThreadKey,
        exchange: { question: string; answer: string; model: ModelAlias; sessionId?: string },
      ) => void
    >();
  });

  it('ThreadStore.subscribe takes a key listener and returns an unsubscribe function', () => {
    type Subject = import('../../src/core/thread-store').ThreadStore['subscribe'];
    expectTypeOf<Subject>().toEqualTypeOf<
      (listener: (key: ThreadKey) => void) => () => void
    >();
  });
});

describe('Answer Renderer (src/core/answer-renderer)', () => {
  it('renderAnswerHtml turns Markdown into an HTML string', () => {
    type Subject = typeof import('../../src/core/answer-renderer').renderAnswerHtml;
    expectTypeOf<Subject>().toEqualTypeOf<(markdown: string) => string>();
  });

  it('toNoteHtml turns question and answer pairs into a note HTML string', () => {
    type Subject = typeof import('../../src/core/answer-renderer').toNoteHtml;
    expectTypeOf<Subject>().toEqualTypeOf<
      (turns: Array<{ question: string; answer: string }>) => string
    >();
  });

  it('toAnnotationText turns a question and answer into a comment string', () => {
    type Subject = typeof import('../../src/core/answer-renderer').toAnnotationText;
    expectTypeOf<Subject>().toEqualTypeOf<(question: string, answer: string) => string>();
  });
});

describe('preferences schema (src/core/prefs-schema)', () => {
  it('PrefName is cliPath, defaultModel, aboutMe or answerLanguage', () => {
    type Subject = import('../../src/core/prefs-schema').PrefName;
    expectTypeOf<Subject>().toEqualTypeOf<
      'cliPath' | 'defaultModel' | 'aboutMe' | 'answerLanguage'
    >();
  });
});

describe('registration modules (src/modules/*)', () => {
  it('registerClaudePane takes nothing and returns void', () => {
    type Subject = typeof import('../../src/modules/claude-pane').registerClaudePane;
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });

  it('unregisterClaudePane takes nothing and returns void', () => {
    type Subject = typeof import('../../src/modules/claude-pane').unregisterClaudePane;
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });

  it('registerReaderPopup takes nothing and returns void', () => {
    type Subject = typeof import('../../src/modules/reader-popup').registerReaderPopup;
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });

  it('unregisterReaderPopup takes nothing and returns void', () => {
    type Subject = typeof import('../../src/modules/reader-popup').unregisterReaderPopup;
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });

  it('registerPrefsPane takes no arguments', () => {
    type Subject = Parameters<typeof import('../../src/modules/prefs-pane').registerPrefsPane>;
    expectTypeOf<Subject>().toEqualTypeOf<[]>();
  });

  // The contract types the return as `Promise<void> | void`: a synchronous or
  // an asynchronous registration both satisfy it.
  it('registerPrefsPane returns void or a promise of void', () => {
    type Subject = ReturnType<typeof import('../../src/modules/prefs-pane').registerPrefsPane>;
    expectTypeOf<Subject>().toExtend<Promise<void> | void>();
  });

  it('unregisterPrefsPane takes nothing and returns void', () => {
    type Subject = typeof import('../../src/modules/prefs-pane').unregisterPrefsPane;
    expectTypeOf<Subject>().toEqualTypeOf<() => void>();
  });
});
