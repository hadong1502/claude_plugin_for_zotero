# Manual checks: Ask Claude about an area or an existing annotation (#14)

Run these against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed in a test profile. Story numbers refer to the spec in #14.

**Preparation.** Open the PDF of a regular item that has equations and figures. Create the following on it:
- an Area Annotation around a figure, using the Select Area tool;
- an Area Annotation around a display equation;
- a highlight with no comment;
- an underline with the comment `Is this the same as eq. 2?`;
- a note annotation and an ink annotation.

Open Process Explorer, or use the plugin-process command from the #1 checklist.

| # | Step | Expected |
|---|------|----------|
| 1 | Right-click the figure's Area Annotation on the page. | The menu has **Ask Claude**. (Stories 1, 3) |
| 2 | Click **Ask Claude**. | The Inline Card opens next to the boxed region, with the Quick Actions, question box, model picker and Use full paper. No blue marker appears. (Stories 4, 6, 17) |
| 3 | Type `What does this figure show?` and send. | The Answer describes the figure's content, so the picture reached Claude. The card shows no `"""` text block. (Story 7) |
| 4 | Right-click the equation's Area Annotation → Ask Claude → **Explain the math**. | The Answer restates the equation in LaTeX that matches the page, then explains it. (Story 7) |
| 5 | Scroll and zoom while the card is open. | The card follows the region and hides when the region scrolls out of view. (Story 5) |
| 6 | Right-click the highlight → Ask Claude → **Explain**. | The Answer is about that highlight's passage. (Stories 2, 8) |
| 7 | Right-click the underline with the comment → Ask Claude, and ask `Answer my comment`. | Claude addresses "Is this the same as eq. 2?", so the comment reached it. (Story 9) |
| 8 | Scroll so a highlight is off-screen, then do steps 1–2 on it from the **annotations sidebar** instead of the page. | The same **Ask Claude** item appears. The reader scrolls to the annotation and the same card appears next to it, not hidden. (Story 3) |
| 9 | Select two annotations (Ctrl+click in the sidebar) and right-click. | No **Ask Claude** item. (Story 10) |
| 10 | Right-click the note annotation, then the ink annotation. | No **Ask Claude** item. (Story 11) |
| 11 | In a card opened from the underline, let the Answer finish and press **Add to annotation**. | The button confirms the save. The underline's comment now reads `Is this the same as eq. 2?`, a blank line, then `Q: …`, a blank line, and the Answer. No new highlight is created. (Stories 12, 13) |
| 12 | Ask a second question in a new card on the same underline, then press **Add to annotation** again. | A second `Q: …` block follows the first, separated by a blank line. Nothing is overwritten. (Story 14) |
| 13 | In a card opened from a highlight, press **Save as note**, then **Continue in Pane**. | A child note is created, and the pane shows the exchange, as for a fresh highlight. (Story 15) |
| 14 | Open a PDF in a group library where you can't edit, or use an annotation imported from the PDF file (it shows a lock). Right-click it → Ask Claude. A group annotation created by another member counts too. | The card works. Under the finished Answer there's **Save as note** (if you can write notes) and **Continue in Pane**, but no **Add to annotation**. (Story 16) |
| 15 | Highlight fresh text and press the popup's **Ask Claude** button. | Unchanged from #1: a blue marker appears and the button reads **Save as annotation**, which creates a new highlight. |
| 16 | Open an EPUB, create a highlight, and right-click it. | No **Ask Claude** item. (Story 19) |
| 17 | Disable the plugin in Tools → Plugins, then right-click an annotation. | No **Ask Claude** item, and no console errors. Re-enable the plugin, and the item is back. |
| 18 | Move an item with an annotated PDF to the trash, open the PDF from the trash, right-click an annotation → Ask Claude. | The card works, but under the finished Answer there is no **Add to annotation**. (Story 16) |

## Watch for these (not verifiable statically)

- **The menu event's data.** The plugin reads the selected annotation keys from `params.ids`, as Zotero documents it. If the item never appears for one annotation, record which annotation type and where you right-clicked.
- **Split view.** A card opened from an annotation anchors through the primary view. In split view, an annotation in the second pane may anchor at the view's top centre instead. Record what you see.
- **Picture fallback.** If an Area Annotation's picture can't be rendered (for example in Reading Mode), the question still goes. Claude is told the region has no text and no picture, so its Answer will say it can't see the region.
