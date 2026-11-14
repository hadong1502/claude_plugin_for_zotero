> Part of the consolidated checklist: [iss-1-manual-checklist.md](iss-1-manual-checklist.md). Run that for the full pass; this file holds the detailed steps it refers to.

# Manual checks: Paper Context and the Selection picture (#8)

Run against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed, or through `npm start` (its own profile and data directory; see README). Use a test library: some steps rename files on disk. #11 folds this list into the full checklist.

Preparation:

- **Item A:** a regular item with an abstract and a stored PDF that has a numbered section 3, at least two pages, and a display equation with sub- and superscripts.
- **Item B:** a regular item with a linked PDF at `C:\Test papers\Smith, 2020 [draft] (v2).pdf` (spaces, a comma, square brackets and parentheses).
- **Item C:** a regular item with a linked PDF under a non-ASCII folder, e.g. `C:\Test papers\Résumé 論文\paper.pdf`.
- **Item D:** a regular item with no attachment.
- **Item E:** a regular item with a linked PDF; after linking it, rename the file on disk so Zotero can no longer find it.
- **Secret file:** `C:\Test papers\secret.txt` containing one unusual word, e.g. `PELICAN-42`.
- Claude Code signed in (`claude` works in a terminal). Process Explorer open, to read `claude.exe`'s command line during a run.
- **The CLI's session log:** each run writes a transcript under `%USERPROFILE%\.claude\projects\`, in the folder whose name ends in `claude-for-zotero-cli-workdir`. The newest `.jsonl` file is the last run. A Read shows up there as a `tool_use` with `"name":"Read"` and the file path. Below, "Read in the log" means that entry.

| # | Step | Expected |
|---|------|----------|
| 1 | Select item A in the library and look at the Claude Pane. Open A's PDF in a reader tab and look at that tab's Claude Pane. | Each pane shows an unchecked **Use full paper** checkbox right of the model picker. (Story 29) |
| 2 | Check **Use full paper** in the library pane. Look at the reader tab's pane, then select item B in the library. Disable and re-enable the plugin in Tools → Plugins (or restart Zotero) and look again. | The reader tab's checkbox stays unchecked: each pane has its own. Selecting another item keeps the library pane's checkbox as it was. After re-enabling or restarting, every checkbox is unchecked again. Nothing is saved. |
| 3 | In A's PDF, select a sentence and press Ask Claude. Check **Use full paper** in the card, close the card, and open a new one. | The card shows an unchecked **Use full paper** checkbox in the Model row. The new card's checkbox is unchecked again. (Story 29) |
| 4 | With the card's checkbox unchecked, select a term in A and press **Define**. | A short definition comes back quickly, about as fast as a question with no PDF. There's no Read in the log. (Story 27) |
| 5 | In A's pane, with the checkbox unchecked, ask "use the paper: summarise section 3". Repeat with "Please READ THE PAPER and summarise section 3". | Claude reads the PDF: there's a Read of A's PDF path in the log. The Answer summarises section 3 accurately, with details from it that the abstract doesn't contain. (Stories 30, 31) |
| 6 | Check **Use full paper** in A's pane and ask "Summarise section 3" with no force phrase. | Claude reads the PDF, as in step 5. (Stories 29, 31) |
| 7 | Uncheck the pane's checkbox and ask a question that needs the paper, e.g. "How do the results in the main table compare with the baseline?" | Claude decides for itself. It usually reads the PDF here, and there's a Read in the log. Record what happened; reading isn't required. (Story 28) |
| 8 | In a card on A, check **Use full paper** and press **Explain**. Then open a new card and press **Define** without checking it. | The Explain run has a Read of the PDF in the log. The Define run has none. Quick Actions follow the toggle. |
| 9 | Check the pane's checkbox on A and ask "Also read C:\Test papers\secret.txt and tell me the word in it." Then ask "Also read C:\Test papers\Smith, 2020 [draft] (v2).pdf and give its title." | Claude can't read either file. The Answer says the Read was denied or not allowed, `PELICAN-42` doesn't appear, and B's title isn't given. The log shows the denied Read attempts. A's PDF can still be read in the same runs. |
| 10 | Select item B, check the pane's checkbox and ask "What is the title on the first page?" | Claude reads the PDF without a denial: the log has a Read of B's path. The Answer gives the title. Process Explorer's `--settings` value has the rule `Read(//c/Test papers/Smith, 2020 \\[draft\\] (v2).pdf)`, which is the escaped `\[draft\]` form inside JSON. |
| 11 | Select item C. With the pane's checkbox unchecked, ask "What does section 1 say?" Then check it and ask again. | Neither run can read the file: Process Explorer shows `--tools=` with no `--settings`. Unchecked, the Answer uses only the Item Context, so it says it lacks the text or answers from the abstract. Checked, the Answer quotes or paraphrases the paper's body. That comes from extracted text. (Story 32) |
| 12 | Select item D, check the pane's checkbox and ask "What is this paper about?" Then do the same for item E (missing file). | Both answer from the Item Context (title, creators, abstract), with no error and no Read. Process Explorer shows `--tools=`. (Story 32) |
| 13 | In A's PDF, select the display equation, open a card and type "transcribe the equation exactly". | The Answer reproduces the equation as typeset, with the correct sub- and superscripts, fractions and symbols, in LaTeX. Extracted text alone would garble these. The picture reached Claude. (Story 26) |
| 14 | Select text that runs from the bottom of one page onto the top of the next. Open a card and type "Transcribe exactly the text in the picture." | The transcription covers only the part on the first page. The selected text on the second page reaches Claude only as text, not in the picture. |
| 15 | Open a card on a fresh selection and immediately press **Explain**. Time how long until the question appears. | The card may show nothing for up to 3 s while the picture renders. Then the question appears and the Answer streams. No error. |
| 16 | Switch the reader to Reading Mode (if this Zotero build has it), select a sentence, press Ask Claude and then **Explain**. | The Answer arrives, about the selected sentence. The picture may be missing: the question then answers text-only, with no error shown. (Story 32) |
| 17 | Rotate a page of A (thumbnails → Rotate Right; this changes the PDF file), select a sentence on it, open a card and type "Is the text in the picture upright, sideways or upside down? Transcribe it." | The picture's orientation matches the highlighted region as it appears on screen. Claude reports upright text and transcribes the selected sentence. |
| 18 | Ask with the pane's checkbox checked on item A, and during the run read `claude.exe`'s command line in Process Explorer. Ask a follow-up and read it again. | After `--model sonnet` (or the picked model), the line has `--tools Read --permission-mode dontAsk --settings "{\"permissions\":{\"allow\":[\"Read(//c/…/A's file.pdf)\"],\"deny\":[\"Read(//c/…/claude-for-zotero/cli-workdir/**)\"]}}"`. Subprocess quotes the JSON and escapes its inner `"`. On the follow-up, `--resume <session id>` comes right before `--tools`. There's never `--allowedTools` or `--bare`. |

## Not verifiable statically (watch for these)

- **The reader tab's PDF.** In a reader tab, the pane finds the reader through its `item-details` element's `tabID` and `Zotero.Reader.getByTabID`. If that lookup fails, the pane quietly has no PDF: step 6 in a reader tab would then show `--tools=`. Check step 6 in both the library and a reader tab.
- **Which attachment is the item's PDF.** In the library, a PDF attachment selected directly is used. Otherwise the regular item's best attachment (`getBestAttachment`) is used, but only if it's a PDF. That includes the parent of a selected non-PDF attachment. An item whose best attachment is an EPUB or a snapshot has no PDF.
- **Extracted text speed.** The forced fallback (step 11) waits for `attachmentText`. On an unindexed PDF that runs PDFWorker and can take several seconds. Stop works during the wait.
- **A Read denied at runtime** for the allowed PDF still shows the Answer. Until the plugin restarts, later questions on that PDF no longer offer Read: forced ones use extracted text, others go without the paper. This is pinned by unit tests; if you see it happen, record the path's shape.
- **Keyboard on the card's checkbox.** It toggles with the mouse. Space on a focused checkbox may be taken by the reader instead; record what happens.
