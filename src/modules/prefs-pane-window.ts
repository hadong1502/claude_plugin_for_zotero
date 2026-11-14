// Wiring of the preferences pane markup (addon/content/preferences.xhtml),
// run in Zotero's settings window when the pane loads (#5). The CLI path,
// default model and About me fields are bound by Zotero through their
// `preference` attributes; this adds the Answer language mapping (`match` is
// shown as an empty field) and the auto-detected CLI path.
import { answerLanguageFromField, answerLanguageToField, cliPathStatus } from '../core/prefs-pane-text';
import { detectCliPathInZotero } from './cli-locator';
import { getPref, setPref } from './prefs';

export function initPrefsPane(root: Element): Promise<void> {
  const doc = root.ownerDocument;

  const language = doc.getElementById('claude-for-zotero-answer-language') as HTMLInputElement | null;
  if (language) {
    language.value = answerLanguageToField(getPref('answerLanguage'));
    language.addEventListener('input', () => {
      setPref('answerLanguage', answerLanguageFromField(language.value));
    });
  }

  const cliInput = doc.getElementById('claude-for-zotero-cli-path') as HTMLInputElement | null;
  const status = doc.getElementById('claude-for-zotero-cli-status');
  let detected: string | null = null;
  let detectionDone = false;
  const render = () => {
    if (status && detectionDone) status.textContent = cliPathStatus(cliInput?.value ?? '', detected);
  };
  // Zotero fills bound fields after 'load', so re-render when it does.
  cliInput?.addEventListener('input', render);
  cliInput?.addEventListener('syncfrompreference', render);

  // Detect in the background so the pane shows at once.
  detectCliPathInZotero()
    .catch((e: unknown) => {
      Zotero.logError(e instanceof Error ? e : new Error(String(e)));
      return null;
    })
    .then((path) => {
      detected = path;
      detectionDone = true;
      // The placeholder shows only while no override is set.
      if (cliInput) cliInput.placeholder = path ?? 'Not found';
      render();
    });

  return Promise.resolve();
}
