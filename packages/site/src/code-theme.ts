import nightOwl from '@shikijs/themes/night-owl';

const FOREGROUNDS: Readonly<Record<string, string>> = {
  // Starlight's Night Owl property color, which the docs fences already showed.
  '#BAEBE2': '#7FDBCA',
  // Night Owl's comment color is too faint on this background.
  '#637777': '#AEB1C1',
};

/** One theme for every highlighted snippet on the marketing and docs sites. */
export const codeTheme = {
  name: 'domfx',
  type: 'dark' as const,
  colors: { ...nightOwl.colors, 'editor.background': '#101117', 'editor.foreground': '#D6DEEB' },
  tokenColors: (nightOwl.tokenColors ?? []).map((rule) => {
    const { foreground, fontStyle } = rule.settings;
    return {
      ...rule,
      settings: {
        ...rule.settings,
        ...(foreground ? { foreground: FOREGROUNDS[foreground.toUpperCase()] ?? foreground } : {}),
        ...(fontStyle ? { fontStyle: fontStyle.replace('italic', '').trim() } : {}),
      },
    };
  }),
};
