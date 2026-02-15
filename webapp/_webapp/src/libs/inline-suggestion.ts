/*
 * This file is brand new implementation of inline-suggestion
 * for Overleaf
 *
 * Author: @Junyi-99 and @wjiayis
 * Date: Feb 7, 2026
 *
 */

import {
  EditorView,
  WidgetType,
  Decoration,
  keymap,
  hoverTooltip,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
} from "@codemirror/view";

import {
  EditorState,
  EditorSelection,
  TransactionSpec,
  StateEffectType,
  StateField,
  Prec,
  StateEffect,
  Text as CodeMirrorText,
  Extension,
  Transaction,
} from "@codemirror/state";

import { logDebug, logError, logInfo } from "./logger";
import { useSettingStore } from "../stores/setting-store";
import { getCitationKeys } from "../query/api";
import { getProjectId } from "./helpers";

/** A completion trigger associates a trigger text (eg "\cite{") with a handler function. */
type CompletionTrigger = {
  triggerText: string;
  handler: (state: EditorState, triggerText: string) => Promise<string>;
};

/** Max characters to look back for sentence extraction (prevents unbounded context). */
const MAX_CONTEXT_CHARS = 1000;

/** Completion handler for citation keys (triggered by "\cite{"). */
async function completeCitationKeys(state: EditorState, triggerText: string): Promise<string> {
  const cursorPos = state.selection.main.head;
  const textBeforeStart = Math.max(0, cursorPos - triggerText.length - MAX_CONTEXT_CHARS);
  const textBefore = state.doc.sliceString(textBeforeStart, cursorPos - triggerText.length);

  // Split by sentence-ending punctuation and get the last sentence
  const sentences = textBefore
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  // Fall back to the bounded window if no sentence boundary found
  const lastSentence = sentences.length > 0 ? sentences[sentences.length - 1] : textBefore.trim();
  if (!lastSentence) {
    return "";
  }

  const projectId = getProjectId();
  if (!projectId) {
    return "";
  }

  try {
    const response = await getCitationKeys({
      sentence: lastSentence,
      projectId: projectId,
    });
    return response.citationKeys.join(",");
  } catch (err) {
    logError("inline completion: failed", err);
    return "";
  }
}

/** Registry of completion triggers. */
const COMPLETION_TRIGGERS: CompletionTrigger[] = [{ triggerText: "\\cite{", handler: completeCitationKeys }];

/** Returns the trigger that matches at cursor position, or null if none. */
function getTriggerAtCursor(state: EditorState): CompletionTrigger | null {
  const cursorPos = state.selection.main.head;
  for (const trigger of COMPLETION_TRIGGERS) {
    const start = Math.max(0, cursorPos - trigger.triggerText.length);
    if (state.doc.sliceString(start, cursorPos) === trigger.triggerText) {
      return trigger;
    }
  }
  return null;
}

/** Returns true when the cursor is right after any registered trigger text. */
function isTriggerAtCursor(state: EditorState): boolean {
  return getTriggerAtCursor(state) !== null;
}

export enum SuggestionAcceptance {
  REJECTED = 0,
  ACCEPTED = 1,
}

export type SuggestionFetchFn = (state: EditorState) => Promise<string>;

export type SuggestionConfig = {
  acceptOnClick: boolean;
  debounce: number;
  completion: SuggestionFetchFn;
};

export type SuggestionState = {
  suggestion: string | null;
  doc: string | null;
  pos: number | null; // Position of cursor when suggestion occurred
};

export type SuggestionAcceptanceState = {
  acceptance: SuggestionAcceptance;
};

export type SuggestionFetchState = {
  text: string | null;
  doc: CodeMirrorText;
};

export type OverleafCodeMirror = {
  Decoration: typeof Decoration;
  EditorSelection: EditorSelection;
  EditorView: EditorView;
  Prec: typeof Prec;
  StateEffect: typeof StateEffect;
  StateField: typeof StateField;
  ViewPlugin: typeof ViewPlugin;
  WidgetType: WidgetType;
  hoverTooltip: typeof hoverTooltip;
  keymap: typeof keymap;
  syntaxTree: unknown;
};

/**
 * Creates a debounced version of a function that returns a Promise
 * @param fn Function to debounce
 * @param wait Delay in milliseconds
 * @param abortValue Value to reject with when aborted
 */
export function debouncePromise<T extends (...args: any[]) => any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  fn: T,
  wait: number,
  abortValue: any = undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  let cancel = () => {};
  type ReturnT = Awaited<ReturnType<T>>;

  return (...args: Parameters<T>): Promise<ReturnT> => {
    cancel();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(fn(...args)), wait);
      cancel = () => {
        clearTimeout(timer);
        if (abortValue !== undefined) reject(abortValue);
      };
    });
  };
}

/** Main completion function that dispatches to the appropriate handler based on trigger. */
export async function completion(_state: EditorState): Promise<string> {
  // Only trigger when enable completion setting is on
  const settings = useSettingStore.getState().settings;
  if (!settings?.enableCitationSuggestion) {
    return "";
  }

  // Find matching trigger and call its handler
  const trigger = getTriggerAtCursor(_state);
  if (!trigger) {
    return "";
  }

  return trigger.handler(_state, trigger.triggerText);
}

/**
 * Creates an inline suggestion decoration for the given editor view.
 *
 * @param view - The editor view where the suggestion will be displayed.
 * @param suggestionText - The text of the suggestion to be displayed.
 * @param overleafCm - The OverleafCodeMirror instance used to create the decoration.
 * @param configState - The state field containing the suggestion configuration.
 * @param suggestionState - The state field containing the current suggestion state.
 * @param suggestionAcceptanceEffect - The state effect type for accepting the suggestion.
 * @returns A DecorationSet containing the inline suggestion decoration.
 */
export function inlineSuggestionDecoration(
  view: EditorView,
  suggestionText: string,
  overleafCm: OverleafCodeMirror,
  configState: StateField<SuggestionConfig>,
  suggestionState: StateField<SuggestionState>,
  suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>,
) {
  const pos = view.state.selection.main.head;
  const widgets = [];
  const w = overleafCm.Decoration.widget({
    widget: new InlineSuggestionWidget(suggestionText, configState, suggestionState, suggestionAcceptanceEffect),
    side: 1,
  });
  widgets.push(w.range(pos));
  return overleafCm.Decoration.set(widgets);
}

/**
 * A widget that displays an inline suggestion in an editor view.
 * This widget was used by `inlineSuggestionDecoration` to create
 * the inline suggestion decoration.
 *
 * @class InlineSuggestionWidget
 * @extends WidgetType
 *
 * @property {string} suggestion - The suggestion text to display.
 * @property {StateField<SuggestionConfig>} configState - The state field for suggestion configuration.
 * @property {StateField<SuggestionState>} suggestionState - The state field for suggestion state.
 * @property {StateEffectType<SuggestionAcceptanceState>} suggestionAcceptanceEffect - The state effect type for suggestion acceptance.
 *
 * @constructor
 * @param {string} suggestion - The suggestion text to display.
 * @param {StateField<SuggestionConfig>} configState - The state field for suggestion configuration.
 * @param {StateField<SuggestionState>} suggestionState - The state field for suggestion state.
 * @param {StateEffectType<SuggestionAcceptanceState>} suggestionAcceptanceEffect - The state effect type for suggestion acceptance.
 *
 * @method toDOM
 * @param {EditorView} view - The editor view where the widget will be displayed.
 * @returns {HTMLElement} The DOM element representing the suggestion widget.
 *
 * @method accept
 * @param {MouseEvent} e - The mouse event triggered by clicking the suggestion.
 * @param {EditorView} view - The editor view where the suggestion is displayed.
 * @returns {boolean} Returns true if the suggestion was accepted, otherwise false.
 */
class InlineSuggestionWidget extends WidgetType {
  suggestion: string;
  configState: StateField<SuggestionConfig>;
  suggestionState: StateField<SuggestionState>;
  suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>;
  /**
   * Create a new suggestion widget.
   */
  constructor(
    suggestion: string,
    configState: StateField<SuggestionConfig>,
    suggestionState: StateField<SuggestionState>,
    suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>,
  ) {
    super();
    this.suggestion = suggestion;
    this.configState = configState;
    this.suggestionState = suggestionState;
    this.suggestionAcceptanceEffect = suggestionAcceptanceEffect;
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-inline-suggestion";
    span.style.opacity = "0.6";
    span.style.cursor = "pointer";
    span.style.filter = "grayscale(20%)";
    span.textContent = this.suggestion;

    span.onmouseover = () => {
      span.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
      span.style.borderRadius = "3px";
    };

    span.onmouseout = () => {
      span.style.backgroundColor = "transparent";
    };

    span.onclick = (e) => this.accept(e, view);

    return span;
  }
  accept(e: MouseEvent, view: EditorView) {
    const suggestionText = this.suggestion;
    const config = view.state.field<SuggestionConfig>(this.configState);
    if (!config.acceptOnClick) return;

    e.stopPropagation();
    e.preventDefault();

    view.dispatch({
      ...insertCompletionText(
        view.state,
        suggestionText,
        view.state.selection.main.head,
        view.state.selection.main.head,
      ),
    });

    view.dispatch({
      effects: this.suggestionAcceptanceEffect.of({
        acceptance: SuggestionAcceptance.ACCEPTED,
      }),
    });

    return true;
  }
}

export function insertCompletionText(state: EditorState, text: string, from: number, to: number): TransactionSpec {
  return {
    ...state.changeByRange((range) => {
      if (range == state.selection.main)
        return {
          changes: { from: from, to: to, insert: text },
          range: EditorSelection.cursor(from + text.length),
        };
      const len = to - from;
      if (!range.empty || (len && state.sliceDoc(range.from - len, range.from) != state.sliceDoc(from, to)))
        return { range };
      return {
        changes: { from: range.from - len, to: range.from, insert: text },
        range: EditorSelection.cursor(range.from - len + text.length),
      };
    }),
    userEvent: "input.complete",
  };
}

/**
 * Creates a keymap binding for the OverleafCodeMirror instance to handle inline suggestions.
 *
 * @param overleafCm - The OverleafCodeMirror instance.
 * @param suggestionAcceptanceEffect - The state effect type for suggestion acceptance.
 * @param suggestionState - The state field for the suggestion state.
 * @returns A keymap binding with the highest precedence.
 *
 * Note: The `Escape` key handler currently stops the copilot and exits to view mode, which may be a bug.
 *       However, this is not a priority at the moment.
 */
export function createExtensionKeymapBinding(
  overleafCm: OverleafCodeMirror,
  suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>,
  suggestionState: StateField<SuggestionState>,
) {
  return overleafCm.Prec.highest(
    overleafCm.keymap.of([
      {
        key: "Escape",
        run: (view: EditorView) => {
          logDebug("ESCAPE");
          view.dispatch({
            effects: suggestionAcceptanceEffect.of({
              acceptance: SuggestionAcceptance.REJECTED,
            }),
          });
          return true;
        },
      },
      {
        key: "Tab",
        run: (view: EditorView) => {
          try {
            logDebug("TAB");
            const suggestionText = view.state.field<SuggestionState>(suggestionState)?.suggestion;

            // If there is no suggestion, do nothing and let the default keymap handle it
            if (!suggestionText) {
              logInfo("tab handler: no suggestion");
              return false;
            }

            view.dispatch({
              ...insertCompletionText(
                view.state,
                suggestionText,
                view.state.selection.main.head,
                view.state.selection.main.head,
              ),
            });
            logInfo("tab handler: suggestion accepted");
            return true;
          } catch (e) {
            logError("error accepting suggestion:", e);
            return false;
          }
        },
      },
    ]),
  );
}

/**
 * Creates a state field for managing inline suggestions in Overleaf's CodeMirror instance.
 *
 * @param overleafCm - The OverleafCodeMirror instance.
 * @param suggestionFetchedEffect - The state effect type for when a suggestion is fetched. (an event type for event checking)
 * @param suggestionAcceptanceEffect - The state effect type for when a suggestion is accepted. (an event type for event checking)
 * @returns A StateField that manages the suggestion state.
 *
 * The state field maintains the following properties:
 * - `suggestion`: The current suggestion text.
 * - `doc`: The current document text.
 * - `pos`: The current cursor position.
 *
 * The state is updated based on the following conditions:
 * - If the document changes, the suggestion state is reset. (because the suggestion is no longer valid)
 * - If the cursor moves, the suggestion state is reset. (the suggestion cannot be applied to a different location)
 * - If a suggestion is accepted, the suggestion state is reset.
 *
 * - If a suggestion is fetched and the document matches the current state, the suggestion state is updated.
 * - If the transaction is irrelevant to the document state, the previous suggestion state is retained.
 * - TODO: If other key events are triggered, the suggestion state is reset. (for example, Ctrl-Z (undo), Ctrl-Y (redo))
 */
export function createSuggestionState(
  overleafCm: OverleafCodeMirror,
  suggestionFetchedEffect: StateEffectType<SuggestionFetchState>,
  suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>,
): StateField<SuggestionState> {
  return overleafCm.StateField.define<SuggestionState>({
    create() {
      return { suggestion: null, doc: null, pos: null };
    },

    update(previousValue: SuggestionState, tr: Transaction): SuggestionState {
      const suggestionFetched = tr.effects.find(
        (
          e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        ) => e.is(suggestionFetchedEffect),
      );
      const suggestionAcceptance = tr.effects.find(
        (
          e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        ) => e.is(suggestionAcceptanceEffect),
      );

      const prevPos = previousValue.pos;
      const currPos = tr.state.selection.main.head;
      if (tr.docChanged) {
        return { suggestion: null, doc: null, pos: currPos };
      }

      if (prevPos !== null && currPos !== prevPos) {
        return { suggestion: null, doc: null, pos: currPos };
      }

      if (suggestionAcceptance) {
        return { suggestion: null, doc: null, pos: null };
      }

      if (!suggestionFetched) return previousValue;

      if (!tr.state.doc) return { suggestion: null, doc: null, pos: null };

      if (tr.state.doc == suggestionFetched.value.doc) {
        // if the doc in the event is the same as the current doc, it means the same doc, so it can be updated
        return {
          suggestion: suggestionFetched.value.text,
          doc: tr.state.doc.toString(),
          pos: currPos,
        };
      } else if (!tr.docChanged && !tr.selection) {
        // This transaction is irrelevant to the document state
        // and could be generated by another plugin, so keep
        // the previous value.
        return previousValue;
      }

      return { suggestion: null, doc: null, pos: null };
    },
  });
}

export function createSuggestionConfig(
  overleafCm: OverleafCodeMirror,
  config: SuggestionConfig,
): StateField<SuggestionConfig> {
  return overleafCm.StateField.define<SuggestionConfig>({
    create() {
      return config;
    },
    update(pv: SuggestionConfig) {
      return pv;
    },
  });
}

/**
 * Creates a suggestion fetch plugin for Overleaf's CodeMirror instance.
 * This plugin listens for document changes and fetches suggestions based on the current state.
 *
 * @param overleafCm - The OverleafCodeMirror instance.
 * @param suggestionFetchedEffect - The state effect type for suggestion fetch state. (the event type we want to dispatch)
 * @param suggestionConfig - The state field for suggestion configuration. (to get the config we registered inside CodeMirror)
 *
 * @returns A ViewPlugin class that handles fetching suggestions.
 */
export function createSuggestionFetchPlugin(
  overleafCm: OverleafCodeMirror,
  suggestionFetchedEffect: StateEffectType<SuggestionFetchState>,
  suggestionConfig: StateField<SuggestionConfig>,
) {
  return overleafCm.ViewPlugin.fromClass(
    class Plugin {
      async update(update: ViewUpdate) {
        try {
          if (!update.docChanged) return;

          // Check if the docChange is due to an remote collaborator
          // @ts-expect-error - changedRanges is only available in the Overleaf version of CodeMirror
          const changedRanges = update.changedRanges;
          const localPos = update.view.state.selection.main.head;

          // Local changes should have the cursor within or at the end of the changed range
          if (changedRanges && changedRanges.length > 0) {
            const changedRange = changedRanges[0];
            if (localPos < changedRange.fromB || localPos > changedRange.toB) {
              return;
            }
          }

          const config = update.state.field<SuggestionConfig>(suggestionConfig);
          if (!config.completion) {
            logError("completion function not configured");
            return;
          }

          // Execute the completion function and get suggestion text
          const result = await config.completion(update.state);
          if (!result || result === "") {
            return;
          }

          // Log result and dispatch effect to update the suggestion state
          logInfo("plugin:fetch:suggestion:result", result);

          update.view.dispatch({
            effects: suggestionFetchedEffect.of({
              text: result,
              doc: update.state.doc,
            }),
          });
        } catch (e) {
          logError("failed to fetch suggestion:", e);
        }
      }
    },
  );
}

/**
 * Creates a plugin to render inline suggestions in Overleaf's CodeMirror editor.
 * This plugin is **ONLY responsible for rendering** the suggestion and does **NOT** handle fetching.
 *
 * @param overleafCm - The OverleafCodeMirror instance.
 * @param suggestionAcceptanceEffect - The state effect type for suggestion acceptance. (the event type we want to dispatch)
 * @param suggestionState - The state field for the suggestion state. (to get the current state of our extension)
 * @param suggestionConfig - The state field for the suggestion configuration. (to get the config we registered inside CodeMirror)
 * @returns A ViewPlugin class that handles rendering of inline suggestions.
 */
export function createRenderInlineSuggestionPlugin(
  overleafCm: OverleafCodeMirror,
  suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>,
  suggestionState: StateField<SuggestionState>,
  suggestionConfig: StateField<SuggestionConfig>,
) {
  return overleafCm.ViewPlugin.fromClass(
    class RenderPlugin {
      decorations: DecorationSet;

      constructor() {
        this.decorations = overleafCm.Decoration.none;
      }

      update(update: ViewUpdate) {
        try {
          // TODO: Ensure ghost-text is not updated when docChanged is triggered by mouse click
          const suggestion = update.state.field<SuggestionState>(suggestionState);

          const suggestionText = suggestion?.suggestion;
          if (!suggestionText) {
            this.decorations = overleafCm.Decoration.none;
            return;
          }

          this.decorations = inlineSuggestionDecoration(
            update.view,
            suggestionText,
            overleafCm,
            suggestionConfig,
            suggestionState,
            suggestionAcceptanceEffect,
          );
        } catch (e) {
          logError(e);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/** Suppresses Overleaf's built-in autocomplete when our suggestion is active or pending */
export function createAutocompleteSuppressor(
  overleafCm: OverleafCodeMirror,
  suggestionState: StateField<SuggestionState>,
  suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState>,
) {
  let styleEl: HTMLStyleElement | null = null;

  function suppress() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.textContent = `.cm-tooltip-autocomplete, .ol-cm-references-search-hint { display: none !important; }`;
    document.head.appendChild(styleEl);
  }

  function unsuppress() {
    if (!styleEl) return;
    styleEl.remove();
    styleEl = null;
  }

  return overleafCm.ViewPlugin.fromClass(
    class AutocompleteSuppressor {
      private view: EditorView;
      private handleKeydown: (e: KeyboardEvent) => void;

      constructor(view: EditorView) {
        this.view = view;

        // Capture-phase listener fires before any other handler on child
        // elements (including Overleaf's autocomplete DOM handler).
        this.handleKeydown = (e: KeyboardEvent) => {
          if (e.key !== "Tab") return;

          const suggestion =
            this.view.state.field<SuggestionState>(suggestionState);
          if (!suggestion?.suggestion) return;

          e.preventDefault();
          e.stopImmediatePropagation();

          this.view.dispatch({
            ...insertCompletionText(
              this.view.state,
              suggestion.suggestion,
              this.view.state.selection.main.head,
              this.view.state.selection.main.head,
            ),
          });

          view.dispatch({
            effects: suggestionAcceptanceEffect.of({
              acceptance: SuggestionAcceptance.ACCEPTED,
            }),
          });
        };

        this.view.dom.addEventListener("keydown", this.handleKeydown, true);
      }

      update(update: ViewUpdate) {
        const suggestion =
          update.state.field<SuggestionState>(suggestionState);
        if (suggestion?.suggestion || isTriggerAtCursor(update.state)) {
          suppress();
        } else {
          unsuppress();
        }
      }

      destroy() {
        unsuppress();
        this.view.dom.removeEventListener("keydown", this.handleKeydown, true);
      }
    },
  );
}

export function createSuggestionExtension(overleafCm: OverleafCodeMirror, config: SuggestionConfig): Extension[] {
  // CodeMirror's StateEffect basically equals to PostMessage.
  const suggestionFetchedEffect: StateEffectType<SuggestionFetchState> =
    overleafCm.StateEffect.define<SuggestionFetchState>();
  const suggestionAcceptanceEffect: StateEffectType<SuggestionAcceptanceState> =
    overleafCm.StateEffect.define<SuggestionAcceptanceState>();

  config.completion = debouncePromise(config.completion, config.debounce);

  const suggestionState = createSuggestionState(overleafCm, suggestionFetchedEffect, suggestionAcceptanceEffect);
  const pluginConfigState = createSuggestionConfig(overleafCm, config);

  const suggestionFetchPlugin = createSuggestionFetchPlugin(overleafCm, suggestionFetchedEffect, pluginConfigState);
  const suggestionRenderingPlugin = createRenderInlineSuggestionPlugin(
    overleafCm,
    suggestionAcceptanceEffect,
    suggestionState,
    pluginConfigState,
  );

  const keymapBindingExtension = createExtensionKeymapBinding(overleafCm, suggestionAcceptanceEffect, suggestionState);
  const autocompleteSuppressor = createAutocompleteSuppressor(overleafCm, suggestionState, suggestionAcceptanceEffect);

  return [suggestionState, pluginConfigState, suggestionFetchPlugin, suggestionRenderingPlugin, keymapBindingExtension, autocompleteSuppressor];
}
