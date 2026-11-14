# Manual checks: Saved Notes and Saved Annotations (#9)

Run against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed, or through `npm start` (its own profile and data directory; see README). Use a test library, not one you care about. #11 folds this list into the full checklist.

Preparation:
- **Item A:** a regular item with a PDF child. The PDF has an equation and a page label that differs from its page index, such as "iv" or "312".
- **Item B:** a standalone PDF attachment with no parent item.
- **Item C:** a regular item in a group library where you have read-only access, if you have one.
- Claude Code signed in (`claude` works in a terminal).

Before starting, note how many child notes Item A has and how many annotations its PDF has. Steps 1–3 check that nothing is written without a press, so do them first.

| # | Step | Expected |
|---|------|----------|
| 1 | In Item A's Claude Pane, ask two questions and let both Answers finish. Press Stop on a third question mid-stream. Press Clear. Switch items and come back. | Item A's note count is unchanged. Nothing appears in the notes section or in My Library's unfiled notes. (Story 45) |
| 2 | Open Item A's PDF. Select text, press Ask Claude, and press Explain. Then ask a typed question in the card. Close the card with ✕ and with Esc. | The PDF's annotation count in the annotation sidebar is unchanged, and so is Item A's note count. (Story 45) |
| 3 | Watch the buttons while a pane Answer streams, and while a card Answer streams. | No "Save as note" shows under a streaming pane Answer. The card shows no save buttons until its Answer is done. |
| 4 | In Item A's pane, ask "Give the quadratic formula, inline as $...$ and as a display equation, then a bullet list and a short table". When it finishes, press **Save as note** under that Answer. | The button reads **Saved** for about two seconds, then "Save as note" again. Item A gains exactly one child note. It starts with "**Question:** …" followed by the Answer, keeping its headings, bold text, list and table. (Stories 40, 42) |
| 5 | Open that note in Zotero's note editor (double-click it, or in the item pane). | Inline math shows as a typeset formula inside the sentence, and display math as a centred block. Double-clicking a formula opens Zotero's math editor showing the LaTeX source, which matches the Answer. No "katex" text or raw HTML appears. (Story 42, AC "Math in Saved Notes … renders") |
| 6 | Ask an Answer that mentions prices, such as "What do $5 and $10 buy?", and one with code holding dollars, such as "Show `echo $HOME`". Save each one. | The prices and the code stay plain text in the note, not math. |
| 7 | In the same Thread, ask more questions until there are at least three finished Answers, plus one stopped with partial text and one that failed. For a failure, set a missing CLI path in Settings → Claude, ask, then restore the path. Press **Save Thread as note** (next to Clear). | One new child note appears. It holds every finished turn and the stopped turn with its partial text, in Thread order, separated by horizontal rules. The failed turn is not in it. The button reads **Saved** briefly. (Story 41, AC "Save Thread as note … every turn in order") |
| 8 | Press Clear, or open an item with no Thread. Also try a Thread whose only turn failed, or was stopped before any text. | **Save Thread as note** is disabled. |
| 9 | Select Item B, the standalone PDF, ask in its Claude Pane, and press **Save as note**, then **Save Thread as note**. | Each press creates a standalone note in Item B's library (find it under My Library; it is not added to a collection), since a note cannot be a child of an attachment. No error appears, and the button reads **Saved**. |
| 10 | Open Item A's PDF and select a sentence that runs across two lines. Press Ask Claude, then **Explain**. When the Answer is done, press **Save as annotation**. | The button reads **Saved** briefly. A yellow highlight (or the reader's current highlight colour) appears exactly over the selected text. In the annotation sidebar, its comment is `Q: Explain`, a blank line, then the Answer as plain text with LaTeX kept as `$...$` and Markdown such as `**bold**` kept as typed. Its page label matches the page's label, not its index, and it sorts in reading order with the other annotations. (Stories 43, 44, AC "Save as annotation …") |
| 11 | Do the same with a selection that crosses a page break. | The highlight covers both parts of the selection. |
| 12 | In the card from step 10, press **Save as note**. | One child note is added to Item A, the PDF's parent, with "Question: Explain" and the Answer. Math renders as in step 5. (Story 40 for the Inline Card) |
| 13 | Open a card on Item B's PDF and press **Save as note** when the Answer is done. | A standalone note is created in the library. |
| 14 | Press a save button twice quickly. | Only one note or annotation is created. The button is disabled while saving. |
| 15 | In the card, press **Save as annotation**, then ask a new question in the same card. | The save buttons hide until the new Answer is done, and the new Answer can be saved separately. |
| 16 | If you have Item C (read-only group), ask in its pane and press **Save as note**. | The button reads **Couldn't save** for about two seconds. An error is in Help → Debug Output Logging / Error Console. Nothing else breaks. |
| 17 | Repeat steps 1–2 once more at the end. | Still no writes without a press. (Story 45) |

Afterwards, delete the test notes and annotations by hand; creating items is not undoable in Zotero 10.

## Not verifiable statically (watch for these)

- **Note math markup.** Saved Notes use `<span class="math">$…$</span>` and `<pre class="math">$$…$$</pre>`, which is the format the Zotero note editor reads (spec "Answer Renderer"). Step 5 confirms that the editor turns them into math nodes.
- **Display math in the middle of a paragraph.** For example, "see $$a+b$$ here" on one line. This becomes a `<pre class="math">` inside a `<p>`, and the note editor's HTML parser splits the paragraph around it. Expect the formula on its own line, with the text before and after it kept. Record it if the text is lost.
- **The Selection's annotation.** At the press, the card copies the popup's `params.annotation` with a JSON round-trip: type, colour, sortIndex, page label, position (`pageIndex`, `rects`, `nextPageRects`) and text. If Gecko's cross-compartment wrapper blocks that copy, Save as annotation shows **Couldn't save**, and the Error Console logs the cause. Step 10 confirms that the copy works.
- **Highlight colour.** The plugin uses the colour the popup reports, which is the reader's current one, or `#ffd400` if the popup reports none. It always saves a highlight, even if the popup was in underline mode.
- **Comment format.** Zotero treats an annotation's comment as plain text, so `$...$` and Markdown stay literal there (step 10).
