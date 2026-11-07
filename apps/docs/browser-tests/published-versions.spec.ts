import { expect, test } from '@playwright/test';

import { browserInstallCommand, publishedVersions } from '@domfx/site/published-versions';

for (const prefix of ['/docs', '/docs/es']) {
  test(`@smoke ${prefix} publishes resolved versions in HTML, copied code and Markdown`, async ({
    page,
    request,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => sessionStorage.setItem('copied', text) },
      }),
    );
    await page.goto(`${prefix}/installation/`);
    const content = page.locator('.sl-markdown-content');
    await expect(content).not.toContainText('%DOMFX_');
    const bindingInstallCommand = `pnpm add -E @domfx/gsap@${publishedVersions['@domfx/gsap']}`;
    for (const installCommand of [browserInstallCommand, bindingInstallCommand]) {
      const command = content.locator('.expressive-code').filter({ hasText: installCommand });
      await expect(command.locator('pre code')).toHaveText(installCommand);
      await command.locator('button').click();
      await expect
        .poll(() => page.evaluate(() => sessionStorage.getItem('copied')))
        .toBe(installCommand);
    }
    const browserDependency = `"@domfx/browser": "${publishedVersions['@domfx/browser']}"`;
    await expect(content.locator('pre').filter({ hasText: browserDependency })).toHaveCount(1);
    const manifest = content
      .locator('.expressive-code')
      .filter({ hasText: '"name": "my-domfx-preview"' });
    await expect(manifest).not.toContainText('@domfx/gsap');
    await expect(manifest).not.toContainText('@domfx/core');
    const manifestSource = (
      await manifest.locator('pre code .ec-line .code').allTextContents()
    ).join('\n');
    await manifest.locator('button').click();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('copied')))
      .toBe(manifestSource);
    const markdown = await request.get(`${prefix}/installation.md`);
    expect(markdown.ok()).toBe(true);
    const source = await markdown.text();
    expect(source).toContain(browserInstallCommand);
    expect(source).toContain(bindingInstallCommand);
    expect(source).toContain(browserDependency);
    expect(source).not.toContain('"@domfx/core"');
    expect(source).not.toContain('%DOMFX_');
    const full = await request.get('/llms-full.txt');
    expect(await full.text()).toContain(source.trim());
    for (const slug of ['introduction', 'upgrading']) {
      await page.goto(`${prefix}/${slug}/`);
      await expect(page.locator('.sl-markdown-content')).toContainText(
        publishedVersions['@domfx/browser'],
      );
      await expect(page.locator('.sl-markdown-content')).not.toContainText('%DOMFX_');
    }
  });
}
