> Part of the consolidated checklist: [iss-1-manual-checklist.md](iss-1-manual-checklist.md). Run that for the full pass; this file holds the detailed steps it refers to.

# Manual checks: Markdown and math in the Claude Pane (#6)

Run against Zotero 10.0.x with the built `.scaffold/build/claude-for-zotero.xpi` installed, or through `npm start` (its own profile and data directory; see README). `npm run build` and `npm start` copy KaTeX's CSS, fonts and licence into `addon/content/katex/` first. #11 folds this list into the full checklist.

Preparation: a regular item with a PDF child. Claude Code signed in (`claude` works in a terminal). Check both the library item pane and the context pane of a reader tab for the PDF.

| # | Step | Expected |
|---|------|----------|
| 1 | Ask: "Reply with a level-2 heading, a bulleted list, a 2×2 Markdown table and a fenced Python code block." Look in the library pane and in the reader tab's pane. | Both show a heading, a bulleted list, a table with cell borders and padding, and a code block on a light grey background that scrolls sideways instead of wrapping. Inline `code` has a light background. |
| 2 | Ask: "Reply with the inline formula $\alpha + \beta^2$ and the display formula $$\sum_{i=1}^{n} \frac{1}{i^2}$$ written over several lines." Repeat with Zotero in light and in dark mode (Settings → General → Appearance). | Both formulas are typeset, in KaTeX's fonts (upright Main and italic Math faces, not a fallback serif such as Times). The display formula is centred on its own line and scrolls sideways if too wide. Formulas are readable in both modes. |
| 3 | Watch an Answer with a formula while it streams. | A formula shows as raw `$…` text until its closing `$` arrives, then switches to typeset. The pane does not flicker or jump. |
| 4 | Select some text in an earlier Answer, then ask a new question and let it stream. | The selection in the earlier Answer stays selected for the whole stream. |
| 5 | Ask for a reply with a link, e.g. "Reply with a Markdown link to https://www.zotero.org". Click the link. Also middle-click it. | The system browser opens zotero.org. The Zotero window does not navigate or open a new window. |
| 6 | Ask: "Reply with exactly this text: `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` and [x](javascript:alert(1))". | The tags show as text; no alert appears, no image loads, and `x` is not a clickable `javascript:` link. |
| 7 | Ask for an invalid formula, e.g. "Reply with $\frac{1}{$ and $\notacommand$". | The Answer still renders; bad math shows as red source text or KaTeX's red error text, and the text after it is shown. |
| 8 | Disable the plugin in Tools → Plugins. | The Claude section and sidenav button go away. Answer styles and KaTeX styles are gone from the window (Browser Toolbox → Style Editor no longer lists `katex.min.css` or `pane.css`). Re-enable: the pane is back with styled Answers. |
| 9 | In a reader tab, open the devtools console for the reader document (Browser Toolbox, pick the reader iframe) and run `await (await fetch('chrome://claudeforzotero-katex/content/katex.min.css')).text()`. | The KaTeX stylesheet text is returned, not a security or network error. This prepares #7, which uses the same URL inside the reader. |
