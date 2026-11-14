# Manual checks: Continue in Pane (#10)

Run against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed, or through `npm start` (its own profile and data directory; see README). Use a test library, not one you care about. #11 folds this list into the full checklist.

Preparation:
- **Item A:** a regular item with a PDF child.
- **Item B:** a standalone PDF attachment with no parent item.
- Claude Code signed in (`claude` works in a terminal).
- Help → Debug Output Logging → Enable, so you can read errors afterwards.

The thread-store, prompt and resume rules are covered by vitest (`thread-store-import`, `context-builder-prior`, `ask-controller-prior`, `continue-in-pane`). These checks cover the link, the reveal and what Claude actually remembers.

| # | Step | Expected |
|---|------|----------|
| 1 | Open Item A's PDF. Select a sentence, press **Ask Claude**, then **Explain**. Watch the card while the Answer streams. Then type a question in the same card and press Stop while it streams. | No **Continue in Pane** shows while the Answer streams, or under a stopped or failed Answer. Once an Answer is done, **Continue in Pane** shows on the right of the save buttons. (Story 21) |
| 2 | In the library, select Item A and press **Clear** in its Claude Pane so its Thread is empty. Reopen the PDF tab. Collapse the reader's context pane (the toggle at the right of the reader toolbar, or drag the splitter shut). Select a sentence, press Ask Claude, then **Explain**, and wait for the Answer. Press **Continue in Pane**. | The card closes. The context pane opens on the item pane (not the notes list), scrolled so the Claude section is at the top, and the section is open. Its Thread has one turn: the question reads `Explain — "<the selected sentence>"`, followed by the same Answer the card showed, rendered with math. (AC "adds the exchange as a turn … and reveals the Claude Pane"; stories 21, 22) |
| 3 | In that Claude Pane, ask: "Which passage did I just ask you about? Quote its first five words." | Claude quotes the start of the selected sentence and refers to its earlier explanation. It resumed the Inline Question's CLI session, so it remembers the inline exchange. (AC "On an empty Thread, the next follow-up resumes the Inline Question's CLI session"; story 22) |
| 4 | Still in Item A's PDF tab, ask one more pane question so the Thread clearly has pane turns. Click the notes button in the context pane's sidenav so the notes list shows. Select a different sentence, press Ask Claude, type "What is the main claim of this sentence? Start your answer with ZEBRA." in the card, and wait for the Answer. Press **Continue in Pane**. | The card closes. The context pane switches from the notes list to the item pane and scrolls to the Claude section. The imported turn is the last turn, below the earlier pane turns, with the question `What is the main claim … ZEBRA. — "<the sentence>"`. |
| 5 | In the pane, ask: "What word did your last answer start with, and what sentence was it about?" | Claude answers "ZEBRA" and names the sentence. The pane's own session never saw the inline question, so this shows the next follow-up carried the exchange as quoted prior context. (AC "On a non-empty Thread, the next follow-up includes the exchange as quoted prior context"; story 22) |
| 6 | Ask one more question in the pane: "Repeat the word again." | Claude still answers "ZEBRA". It now remembers through the resumed pane session; the quoted block was sent only once. |
| 7 | Collapse the Claude section by clicking its header, and scroll the item pane back to the top (Info). Open another card in the same PDF, wait for its Answer, and press **Continue in Pane**. | The Claude section opens again and is scrolled to the top of the item pane. The new turn is appended. |
| 8 | Select a passage longer than 200 characters (several lines), press Ask Claude, then **Define**, and press **Continue in Pane** when it is done. | The imported question shows `Define — "<first 200 characters>…"`, with the line breaks of the selection folded into spaces. |
| 9 | Open Item B (the standalone PDF). Clear its Claude Pane first if it has a Thread. Ask in a card and press **Continue in Pane**. | The turn lands in Item B's own Thread (the pane shown in Item B's reader tab, and in the library pane when Item B is selected), not in any other item's Thread. |
| 10 | Select Item A in the library tab and look at its Claude Pane. | It shows the same Thread as the reader tab, including the imported turns. The Thread is shared by the item and its PDF. |
| 11 | In Item A's pane, press **Clear**, then ask a new question. | The new question starts a fresh session: Claude does not know the earlier inline or pane exchanges. |
| 12 | Optional: right-click Item A's PDF → Open in New Window. Ask in a card there and press **Continue in Pane**. | The card closes and the turn is in Item A's Thread (check the library pane), but nothing is revealed, since a separate reader window has no context pane tab. The Error Console logs "Continue in Pane: the reader is not in a tab; nothing to reveal". |

## Not verifiable statically (watch for these)

- **Reveal mechanics.** The reveal uses Zotero internals from 10.0.8 (`ZoteroContextPane.collapsed`, the reader sidenav's `_contextNotesPaneVisible`, the tab's `<item-details id="<tabID>-context">` and its `scrollToPane`). If steps 2, 4 or 7 import the turn but the pane does not open, switch, or scroll, the Error Console should hold a "Continue in Pane: …" error. Record it; the import must still be there.
- **Section id.** Zotero namespaces the section's `data-pane` as `<pluginID>-claude`, and the reveal scrolls to the key `registerSection` returned. If the pane opens but does not scroll to the Claude section, this is the first thing to check (Browser Toolbox → inspect the section's `data-pane`).
- **Expand from collapsed.** While the context pane is collapsed, `scrollToPane` only records the section, and expanding renders the item pane, which scrolls to it; the reveal then scrolls once more. Step 2 confirms there is no visible jump to another section afterwards (for example a pinned pane).
- **Importing while the pane is answering.** If the item's Thread has a question still streaming in the pane, the imported turn is appended after it and the exchange is held as prior context for the next question. The streaming Answer keeps streaming into its own turn.
