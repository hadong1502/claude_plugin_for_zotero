# claude_plugin_for_zotero

A Zotero plugin for asking Claude questions about the papers in a Zotero library, from the reader's side pane and from text highlighted in the reader.

## Surfaces

**Claude Pane**:
The Claude section of Zotero's item pane and reader context pane, reachable by scrolling or by its own button in the pane's side navigation. It holds the item's Thread.
_Avoid_: Sidebar, chat panel, side panel

**Ask Claude Button**:
The button Zotero shows in the reader's text-selection popup that starts an Inline Question about the Selection.
_Avoid_: Popup button, ask button

**Inline Card**:
A floating card pinned next to a Selection in the reader that holds one Inline Question and its Answer, and stays open until the user closes it.
_Avoid_: Popup, tooltip, bubble

## Conversation

**Thread**:
The running conversation with Claude about one parent item (or a standalone attachment), shown in its Claude Pane and kept only until Zotero closes unless saved.
_Avoid_: Chat, session, conversation history

**Inline Question**:
A question asked from an Inline Card about a specific Selection.
_Avoid_: Popup question, quick question

**Answer**:
Claude's reply to one question, rendered as Markdown with math.
_Avoid_: Response, completion, output

**Quick Action**:
A one-click Inline Question with a fixed wording: Explain, Define, or Explain the math.
_Avoid_: Preset, shortcut, chip

**Continue in Pane**:
Moving an Inline Question and its Answer into the item's Thread so the conversation can go on in the Claude Pane.
_Avoid_: Send to sidebar, escalate

## Context

**Selection**:
The passage or region an Inline Question is about: text the user highlighted in the reader when pressing the Ask Claude Button, or an existing highlight, underline or area annotation the user asked about.
_Avoid_: Highlight, quote, snippet

**Area Annotation**:
An image annotation the user drew around part of a PDF page with Zotero's Select Area tool. Asked about, its Selection is a picture of that region with no text.
_Avoid_: Snippet, screenshot, image selection

**Item Context**:
The item's bibliographic metadata (title, authors, year, abstract) that accompanies every question.
_Avoid_: Metadata context, paper info

**Paper Context**:
The content of the item's PDF, which Claude consults when it judges a question needs it, or always when the user asks for it.
_Avoid_: Full-text context, document context

## Saving

**Saved Note**:
A child note of the item holding a question and its Answer, created only when the user asks.
_Avoid_: Export, transcript

**Saved Annotation**:
An annotation whose comment holds an Inline Question and its Answer, created only when the user asks: a new highlight on a freshly highlighted Selection, or the existing annotation the question was about, with the question and Answer appended to its comment.
_Avoid_: Q&A highlight
