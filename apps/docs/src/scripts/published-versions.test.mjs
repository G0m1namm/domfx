import assert from 'node:assert/strict';
import { test } from 'node:test';

import { unified } from '@astrojs/markdown-remark';

import { browserInstallCommand, publishedVersions } from '@domfx/site/published-versions';

import { remarkPublishedVersions } from '../integrations/published-versions.ts';

test('published versions resolve before rendering prose, inline code and copyable code blocks', async () => {
  const markdown = await unified({ remarkPlugins: [remarkPublishedVersions] }).createRenderer({
    syntaxHighlight: false,
  });
  const { code } = await markdown.render(
    [
      'Release %DOMFX_BROWSER_VERSION%.',
      '`%DOMFX_GSAP_VERSION%`',
      '```sh\n%DOMFX_BROWSER_INSTALL%\n```',
      '```json',
      '{"@domfx/core":"%DOMFX_CORE_VERSION%","@domfx/browser":"%DOMFX_BROWSER_VERSION%"}',
      '```',
    ].join('\n\n'),
  );
  assert(code.includes(`Release ${publishedVersions['@domfx/browser']}.`));
  assert(code.includes(`<code>${publishedVersions['@domfx/gsap']}</code>`));
  assert(code.includes(browserInstallCommand));
  assert(code.includes(`"@domfx/core":"${publishedVersions['@domfx/core']}"`));
  assert(!code.includes('%DOMFX_'));
});

test('unknown version placeholders fail the build instead of reaching readers', async () => {
  const markdown = await unified({ remarkPlugins: [remarkPublishedVersions] }).createRenderer({});
  await assert.rejects(
    markdown.render('`%DOMFX_BROWESR_VERSION%`'),
    /Unknown published-version placeholder/,
  );
});
