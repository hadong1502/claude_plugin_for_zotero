// Shared types for Claude for Zotero (#1). Pure: no Zotero or Gecko imports.
// Domain terms follow docs/GLOSSARY.md.

/** Model aliases accepted by the Claude CLI's `--model` flag. */
export type ModelAlias = 'haiku' | 'sonnet' | 'opus';

/** Why a question produced no (complete) Answer. */
export type ErrorKind =
  | 'cli-not-found'
  | 'not-signed-in'
  | 'rate-limited'
  | 'cancelled'
  | 'failed';

/** One event of an Answer stream, as yielded by the Claude Runner. */
export type AnswerEvent =
  | { type: 'started'; sessionId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; sessionId: string }
  | { type: 'error'; kind: ErrorKind; message: string };

/** A prompt content block: text, or a base64-encoded PNG picture. */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: 'image/png'; data: string };

/** Everything the Claude Runner needs to run one question. */
export interface ClaudeRequest {
  content: ContentBlock[];
  model: ModelAlias;
  systemPrompt: string;
  /** Claude session id to resume, for follow-ups in a Thread. */
  resumeSessionId?: string;
  /** Absolute paths Claude may Read: none, or the paper's text file and/or its PDF (#8, #11). */
  readableFiles: string[];
}

/** Whether, and how, Claude reads the paper (Paper Context). */
export type PaperContextMode = 'none' | 'claude-decides' | 'forced';

export type QuickAction = 'explain' | 'define' | 'explain-math';

/** The item's identifying metadata, sent with every question. */
export interface ItemContext {
  title: string;
  creators: string[];
  year?: string;
  abstract?: string;
}

/** The highlighted passage of an Inline Question. */
export interface SelectionContext {
  text: string;
  pageLabel?: string;
  /** Base64 PNG of the highlighted region. */
  imagePng?: string;
  /** The annotation's comment, when the Selection comes from an annotation (#14). */
  comment?: string;
}

/** Input to the Context Builder. */
export interface QuestionInput {
  item: ItemContext;
  question: string;
  quickAction?: QuickAction;
  selection?: SelectionContext;
  paperContext: PaperContextMode;
  pdfPath?: string;
  /** The paper's text file: its extracted text, written by the plugin (#1, #11). */
  textPath?: string;
  /** Fallback Paper Context when Claude cannot read the PDF itself. */
  extractedText?: string;
  aboutMe: string;
  answerLanguage: string;
  /** An imported inline exchange, quoted as prior context (Continue in Pane). */
  priorExchange?: { question: string; answer: string };
}

/** Output of the Context Builder, ready to become a ClaudeRequest. */
export interface BuiltQuestion {
  systemPrompt: string;
  content: ContentBlock[];
  readableFiles: string[];
}

/** A Zotero item ID: the parent item, or a standalone attachment. */
export type ThreadKey = number;

export type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error';

/** One question and its Answer in a Thread. */
export interface Turn {
  id: string;
  question: string;
  answer: string;
  model: ModelAlias;
  status: TurnStatus;
  source: 'pane' | 'inline';
  error?: { kind: ErrorKind; message: string };
}

/** A running conversation with Claude about one item. */
export interface Thread {
  key: ThreadKey;
  sessionId?: string;
  turns: Turn[];
}
