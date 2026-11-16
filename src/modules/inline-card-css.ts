// The Inline Card's stylesheet (#7). The reader document has a content
// principal, so the card's CSS goes inline in a <style> element there rather
// than in a chrome:// sheet. Every rule is scoped under the .cfz-card prefix so
// the reader's own UI is untouched. Colours use the reader's theme variables,
// with fallbacks. The Answer rules mirror addon/content/pane.css.

export const INLINE_CARD_CSS = `
.cfz-card-mark {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  border-radius: 2px;
  background: rgba(56, 128, 255, 0.3);
}
.cfz-card {
  position: fixed;
  z-index: 10000;
  width: 320px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 10px;
  border-radius: 8px;
  background: var(--material-toolbar, var(--color-background, Canvas));
  color: var(--fill-primary, CanvasText);
  box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.55), 0 8px 40px 0 rgba(0, 0, 0, 0.25);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  text-align: start;
  overflow: hidden;
}
.cfz-card * {
  box-sizing: border-box;
}
.cfz-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cfz-card-title {
  font-weight: 600;
}
.cfz-card-page {
  color: var(--fill-secondary, GrayText);
}
.cfz-card-spacer {
  flex: 1;
}
.cfz-card button {
  font: inherit;
  color: inherit;
  margin: 0;
  padding: 2px 8px;
  min-height: 22px;
  border: none;
  border-radius: 5px;
  background: var(--material-button, ButtonFace);
  box-shadow: 0 0.5px 2.5px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(0, 0, 0, 0.05);
  cursor: default;
}
.cfz-card button:hover:not(:disabled) {
  background: var(--fill-quinary, rgba(0, 0, 0, 0.08));
}
.cfz-card button:disabled {
  opacity: 0.5;
}
.cfz-card button:focus-visible,
.cfz-card input:focus-visible {
  outline: 2px solid var(--color-accent, var(--accent-blue, Highlight));
  outline-offset: 1px;
}
.cfz-card .cfz-card-close {
  padding: 0;
  width: 22px;
  background: transparent;
  box-shadow: none;
}
.cfz-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cfz-card-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: text;
}
.cfz-card-body[hidden] {
  display: none;
}
.cfz-card-question {
  font-weight: 600;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-align: right;
  color: var(--fill-secondary, GrayText);
}
.cfz-card-status {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--fill-secondary, GrayText);
}
.cfz-card-status.cfz-card-error {
  color: var(--accent-red, #d00);
}
.cfz-card-saves {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 2px;
}
.cfz-card-saves[hidden] {
  display: none;
}
.cfz-card .cfz-card-continue {
  margin-left: auto;
}
.cfz-card-input-row,
.cfz-card-models {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cfz-card-input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: inherit;
  padding: 3px 6px;
  border-radius: 5px;
  border: 1px solid var(--fill-quinary, rgba(0, 0, 0, 0.2));
  background: var(--material-background, Field);
}
.cfz-card-models {
  flex-wrap: wrap;
}
.cfz-card-models-label {
  color: var(--fill-secondary, GrayText);
}
.cfz-card-full-paper-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  white-space: nowrap;
}
.cfz-card-full-paper {
  margin: 0;
}
.cfz-card .cfz-card-model[aria-pressed="true"] {
  background: var(--accent-blue, Highlight);
  color: #fff;
}
.cfz-card-answer {
  overflow-wrap: anywhere;
}
.cfz-card-answer > :first-child {
  margin-top: 0;
}
.cfz-card-answer > :last-child {
  margin-bottom: 0;
}
.cfz-card-answer p {
  margin: 0 0 0.6em;
}
.cfz-card-answer h1,
.cfz-card-answer h2,
.cfz-card-answer h3,
.cfz-card-answer h4,
.cfz-card-answer h5,
.cfz-card-answer h6 {
  margin: 0.8em 0 0.4em;
  font-size: 1.05em;
}
.cfz-card-answer h1 {
  font-size: 1.25em;
}
.cfz-card-answer h2 {
  font-size: 1.15em;
}
.cfz-card-answer ul,
.cfz-card-answer ol {
  margin: 0 0 0.6em;
  padding-inline-start: 1.5em;
}
.cfz-card-answer blockquote {
  margin: 0 0 0.6em;
  padding-inline-start: 0.8em;
  border-inline-start: 3px solid var(--fill-quinary, rgba(0, 0, 0, 0.15));
}
.cfz-card-answer pre {
  margin: 0 0 0.6em;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--fill-quinary, rgba(0, 0, 0, 0.05));
  overflow-x: auto;
  white-space: pre;
  overflow-wrap: normal;
}
.cfz-card-answer code {
  font-family: monospace;
  font-size: 0.95em;
}
.cfz-card-answer :not(pre) > code {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--fill-quinary, rgba(0, 0, 0, 0.05));
}
.cfz-card-answer table {
  margin: 0 0 0.6em;
  border-collapse: collapse;
  display: block;
  max-width: 100%;
  overflow-x: auto;
}
.cfz-card-answer th,
.cfz-card-answer td {
  padding: 3px 6px;
  border: 1px solid var(--fill-quinary, rgba(0, 0, 0, 0.15));
}
.cfz-card-answer a {
  color: var(--accent-blue, LinkText);
}
.cfz-card-answer .katex-display {
  margin: 0.5em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.cfz-card-answer code.math-error {
  color: var(--accent-red, #d00);
}
`;
