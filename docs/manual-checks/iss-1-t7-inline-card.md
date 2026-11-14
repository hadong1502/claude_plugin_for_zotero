# Manual checks: Ask Claude Button and Inline Card (#7)

Run against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed, or through `npm start` (its own profile and data directory; see README). #11 folds this list into the full checklist.

Preparation: a regular item with a PDF child that has an abstract, at least two pages, and an equation; a second PDF item; an EPUB and a web snapshot attachment. Claude Code signed in (`claude` works in a terminal). Default model in Settings → Claude set to Sonnet unless a step says otherwise.

| # | Step | Expected |
|---|------|----------|
| 1 | Open the PDF and highlight a sentence. | The selection popup shows an **Ask Claude** button under the colour buttons, as wide as "Add to Note" and styled like it. (Story 12) |
| 2 | Open the EPUB and the snapshot, select text in each. | No Ask Claude button in either popup. (Story 23) |
| 3 | In the PDF, select a sentence and press Ask Claude. | A card about 320px wide opens just below the Selection (or above it, if there is more room there), inside the PDF view. It has "Ask Claude", "page N" for the Selection's page label, ✕, the buttons Explain / Define / Explain the math, a focused text field, Send, and Model Haiku / Sonnet / Opus with Sonnet highlighted. (Story 13, 39) |
| 4 | Press **Explain**. | "Explain" shows as the question and the Answer streams in, rendered as Markdown. The Send button reads **Stop** while it streams and **Send** afterwards. The Answer explains the highlighted passage, so the Selection's text reached Claude. (Stories 17, 25, 33, 34) |
| 5 | Select a term or symbol, open a card and press **Define**. | A brief definition of that term as used in the paper. (Story 18) |
| 6 | Select an equation, open a card and press **Explain the math**. | The Answer starts by restating the equation in LaTeX, typeset with KaTeX fonts (upright Main and italic Math faces, not a fallback serif), then explains it. (Stories 19, 35) |
| 7 | Type a question in the card's field, e.g. "Which page is this on and which paper is it from?", press Enter. | The typed question replaces the previous question and Answer (each question starts fresh). The Answer names the page label and the paper's title, so Item Context and the page label are sent. (Stories 20, 24) |
| 8 | While typing in the field, type `h`, `s`, Alt+1, Alt+4, Ctrl+A, Delete, Backspace and arrow keys. | Characters go into the field; Ctrl+A selects the field's text; no annotation tool switches, no annotation is deleted, and focus does not jump. (Story 20) |
| 9 | Pick **Haiku**, ask again; then **Opus**. | The picked model is highlighted and is used (the Answer arrives faster with Haiku). Opening a new card resets the picker to the default model. (Story 38) |
| 10 | Ask a long question (e.g. "Explain in detail, with five sections") and press **Stop** mid-stream. | The partial Answer stays, followed by "Stopped." No `claude` process remains (Task Manager). (Stories 36, 37, 58) |
| 11 | With a card open, scroll the PDF with the wheel, then with the scrollbar. | The card moves with the Selection. When the Selection scrolls out of the view the card hides; scrolling back shows it again in place. (Story 14) |
| 12 | With a card open, zoom in and out (Ctrl+= / Ctrl+-, the toolbar zoom buttons, "Zoom to page width"), including at the very top of page 1. | The card stays next to the Selection after each zoom step. |
| 13 | With a card open, toggle the sidebar, resize the Zotero window, and split the view (View → Split Vertically), then unsplit. | The card follows the Selection. With a split view, a card opened from the second view anchors to the Selection there. |
| 14 | With an Answer streaming in a card, select other text and press Ask Claude in the new popup. | The old card disappears and its `claude` process ends; one new card opens for the new Selection. (Story 15) |
| 15 | Open a card in one PDF tab, switch to the other PDF's tab, select text and press Ask Claude. Switch back. | The first tab's card is gone; only the new card exists. (Story 15, one card across tabs) |
| 16 | With an Answer streaming, press ✕. Repeat, pressing Esc with focus in the card's field. Repeat, clicking in the PDF page first and pressing Esc there. | The card closes each time and the run is cancelled (no `claude` process left). (Story 16) |
| 17 | With an Answer streaming, close the reader tab. | The `claude` process ends. Reopening the PDF shows no card. (Story 58) |
| 18 | Open a card, then check the Claude Pane in the context pane for the same item. | The inline question and Answer do not appear in the pane's Thread. |
| 19 | Ask for a reply with a link, e.g. "Reply with a Markdown link to https://www.zotero.org". Click it, then middle-click it. Ask for `[x](javascript:alert(1))` and `<img src=x onerror=alert(1)>`. | Click opens the system browser; the reader does not navigate. Middle-click does nothing. The unsafe link is not clickable and no alert appears. |
| 20 | Select Answer text in the card with the mouse and copy it (Ctrl+C). | The text selects and copies. |
| 21 | Rename the CLI path in Settings → Claude to a missing file, then press Explain. | The card shows the plain-language "Claude Code CLI not found…" message in red. Restore the path. |
| 22 | With a card open and an Answer streaming, disable the plugin in Tools → Plugins. | The card and any Ask Claude button in an open popup disappear; the `claude` process ends. Selecting text again shows no Ask Claude button. Re-enable: the button is back. (Story 59) |
| 23 | Switch Zotero to dark mode (Settings → General → Appearance) and open a card. | The card follows the reader theme and stays readable. |

## Not verifiable statically (watch for these)

- **Focus and the popup.** Pressing Ask Claude focuses the card's field. The selection popup is not closed by the plugin; it may stay visible under the card until the selection changes. Confirm the card is on top and usable.
- **Tab inside the card.** The reader's focus manager catches Tab on the reader window before the card sees it, so Tab may move focus to the reader's toolbar or sidebar instead of the next card button. Record what happens; it is a known limitation, not a blocker.
- **Anchoring internals.** The card reads the reader's internal PDF view (`_internalReader._activePrimaryView` / `_activeSecondaryView`, `getClientRectForPopup`). If Zotero changes these, the card falls back to where the popup was and stops following scroll. In Reading Mode the same fallback may apply.
- **KaTeX fonts in the reader document** come from `chrome://claudeforzotero-katex/content/` (content-accessible). Check step 6 renders real KaTeX fonts, not a fallback.
- **Zoom with no scroll change** relies on a ResizeObserver on the PDF viewer element; step 12 at the top of page 1 checks it.
