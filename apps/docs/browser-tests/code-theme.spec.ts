import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const KEYWORD = 'rgb(199, 146, 234)';
const QUOTE = 'rgb(217, 245, 221)';
const NUMBER = 'rgb(247, 140, 108)';
const COMMENT = 'rgb(174, 177, 193)';

async function tokenColor(page: Page, root: string, text: string) {
  return page.evaluate(
    ([rootSelector, tokenText]) => {
      const token = [...document.querySelectorAll(`${rootSelector} span`)].find(
        (span) => span.children.length === 0 && span.textContent?.trim() === tokenText,
      );
      return token ? getComputedStyle(token).color : null;
    },
    [root, text],
  );
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`fenced and source snippets share one theme in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/docs/gsap/');
    for (const root of ['.expressive-code', '.docs-code-scroll .astro-code']) {
      expect(await tokenColor(page, root, 'const')).toBe(KEYWORD);
      expect(await tokenColor(page, root, "'")).toBe(QUOTE);
    }
    const comment = page.locator('.docs-code-scroll .astro-code span[style]', {
      hasText: /^\s*\/\/ /,
    });
    await expect(comment.first()).toHaveCSS('color', COMMENT);
  });
}

test('the control box code panel uses the shared theme and stays copyable text', async ({
  page,
}) => {
  await page.goto('/docs/api/effects/fire/?intensity=0.45');
  const code = page.locator('[data-docs-lab] [data-box-code]').first();
  await expect(code).toContainText('intensity: 0.45');
  await expect(code.locator('[data-code="keyword"]', { hasText: 'const' })).toHaveCSS(
    'color',
    KEYWORD,
  );
  await expect(code.locator('[data-code="quote"]').first()).toHaveCSS('color', QUOTE);
  await expect(code.locator('[data-code="number"]', { hasText: '0.45' })).toHaveCSS(
    'color',
    NUMBER,
  );
  expect(await code.textContent()).toMatch(
    /^import \{ attachFire \} from '@domfx\/browser';\n\nconst effect = attachFire\(target, \{\n/,
  );
});
