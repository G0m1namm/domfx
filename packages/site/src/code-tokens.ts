export type CodeTokenKind =
  | 'plain'
  | 'keyword'
  | 'function'
  | 'string'
  | 'quote'
  | 'number'
  | 'literal'
  | 'comment';

export interface CodeToken {
  readonly text: string;
  readonly kind: CodeTokenKind;
}

const TOKEN =
  /(?<comment>\/\/.*)|(?<string>'[^'\n]*')|(?<plain>\{ [\w$]+ \})|(?<keyword>\b(?:import|from|const)\b|[\w$]+(?=:)|[=,:{}])|(?<literal>\b(?:true|false)\b)|(?<number>-?\b\d+(?:\.\d+)?\b)|(?<function>(?<=const )[\w$]+|[\w$]+(?=\())/g;

/**
 * Colors generated attachment snippets in the browser, where a full grammar would be
 * too heavy. Keep its output in step with the shared code theme.
 */
export function codeTokens(source: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let end = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > end) {
      tokens.push({ text: source.slice(end, match.index), kind: 'plain' });
    }
    const [text] = match;
    end = match.index + text.length;
    const kind = Object.entries(match.groups ?? {}).find(
      ([, value]) => value,
    )?.[0] as CodeTokenKind;
    if (kind === 'string') {
      tokens.push(
        { text: "'", kind: 'quote' },
        { text: text.slice(1, -1), kind: 'string' },
        { text: "'", kind: 'quote' },
      );
    } else {
      tokens.push({ text, kind });
    }
  }
  if (end < source.length) {
    tokens.push({ text: source.slice(end), kind: 'plain' });
  }
  return tokens;
}

export function renderCodeTokens(element: HTMLElement, source: string): void {
  const { ownerDocument: document } = element;
  element.replaceChildren(
    ...codeTokens(source).map(({ text, kind }) => {
      const span = document.createElement('span');
      span.dataset.code = kind;
      span.textContent = text;
      return span;
    }),
  );
}
