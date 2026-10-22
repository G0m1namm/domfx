import { expect, test } from '@playwright/test';

import { effectReference } from '@domfx/site/effect-reference';
import { effects } from '@domfx/site/effects';
import { docsSlugs, languageHref } from '@domfx/site/locale';

import { effectReferenceEs } from '../src/content/effect-reference-es';

test('@smoke every Spanish guide and effect reference has its own page', async ({ request }) => {
  for (const slug of docsSlugs) {
    const spanish = await request.get(`/docs/es/${slug}/`);
    const english = await request.get(`/docs/${slug}/`);
    expect(spanish.ok(), slug).toBe(true);
    const spanishHtml = await spanish.text();
    const englishHtml = await english.text();
    expect(spanishHtml, slug).toContain('<html lang="es"');
    const description = spanishHtml.match(/<meta name="description" content="([^"]+)"/)?.[1];
    const englishDescription = englishHtml.match(/<meta name="description" content="([^"]+)"/)?.[1];
    expect(description, slug).toBeTruthy();
    expect(description, slug).not.toBe(englishDescription);
  }

  for (const effect of effects) {
    const response = await request.get(`/docs/es/api/effects/${effect.id}/`);
    expect(response.ok(), effect.id).toBe(true);
    const html = await response.text();
    expect(html, effect.id).toContain('<html lang="es"');
    expect(html, effect.id).toContain(effectReferenceEs[effect.id].description);
    expect(html, effect.id).toContain(effectReferenceEs[effect.id].intensity);
    expect(html, effect.id).not.toContain(effectReference[effect.id].description);
    expect(html, effect.id).toContain('id="usage"');
    expect(html, effect.id).toContain('id="effect-options"');
  }
});

test('@smoke Spanish docs direct load keeps navigation, anchors and native controls', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined });
  });
  await page.goto('/docs/es/');
  await expect(page).toHaveURL(/\/docs\/es\/introduction\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: 'Introducción', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Ruta de navegación' })).toBeVisible();
  await expect(page.locator('#start-with-your-element')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Instalación', exact: true }).first(),
  ).toHaveAttribute('href', '/docs/es/installation/');

  await page.goto('/docs/es/api/effects/fire/?source=guide#usage');
  await expect(page.getByRole('heading', { name: 'Uso', level: 2 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'En esta página' })).toContainText(
    'Opciones del efecto',
  );
  await expect(page.locator('[data-docs-lab-status]')).toHaveText(
    'Los efectos no están disponibles en este navegador. El contenido original sigue visible.',
  );
  await expect(page.getByRole('button', { name: 'Efectos no disponibles' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'galería' })).toHaveAttribute(
    'href',
    '/es/effects/#fire',
  );
  await expect(page.locator('[data-language-link="en"]').first()).toHaveAttribute(
    'href',
    '/docs/api/effects/fire/?source=guide#usage',
  );

  const code = await page.locator('[data-docs-lab-code]').textContent();
  await page.getByRole('button', { name: 'Copiar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-docs-lab-copy-label]')).toContainText(
    /Copiado|Pulsa ⌘\/Ctrl\+C/,
  );
  expect(code).toContain('attachFire(target');
  expect(code).toContain('flameHeight: 32');
});

test('@smoke Spanish docs reflow at 320 pixels and larger text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/docs/es/standalone/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
  await expect(page.getByRole('button', { name: 'Documentación', exact: true })).toBeVisible();
  await expect(page.locator('.docs-mobile-title')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Uso independiente', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 700 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `${width}px`,
    ).toBeLessThanOrEqual(width);
  }
});

test('Spanish table of contents keeps the equivalent section when changing language', async ({
  page,
}) => {
  await page.goto('/docs/es/api/effects/?from=toc');
  await page
    .getByRole('navigation', { name: 'En esta página' })
    .getByRole('link', { name: 'Energía' })
    .click();
  await expect(page).toHaveURL(/#energ%C3%ADa$/);
  await page.locator('[data-language-link="en"]').first().click();
  await expect(page).toHaveURL('/docs/api/effects/?from=toc#energy');
  await expect(page.getByRole('heading', { name: 'Energy', level: 2 })).toBeVisible();
});

test('explicit API anchor survives a language switch', async ({ page }) => {
  await page.goto('/docs/api/#create-an-attachment');
  await page.locator('[data-language-link="es"]').first().click();
  await expect(page).toHaveURL('/docs/es/api/#create-an-attachment');
  await expect(page.locator('#create-an-attachment')).toBeInViewport();
});

test('every Spanish guide TOC section has an equivalent English anchor', async ({
  page,
  request,
}) => {
  for (const slug of docsSlugs) {
    await page.goto(`/docs/es/${slug}/`);
    const fragments = await page
      .getByRole('navigation', { name: 'En esta página' })
      .locator('a[href^="#"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hash));
    const english = await (await request.get(`/docs/${slug}/`)).text();
    for (const fragment of fragments) {
      const equivalent = languageHref(`https://domfx.dev/docs/es/${slug}/${fragment}`, 'en');
      expect(equivalent, `${slug}${fragment}`).toContain('#');
      const anchor = equivalent?.split('#')[1];
      expect(english, `${slug}${fragment} → ${anchor}`).toContain(`id="${anchor}"`);
    }
  }
});

test('every shared explicit docs anchor survives both language switches', async ({ request }) => {
  for (const slug of docsSlugs) {
    const english = await (await request.get(`/docs/${slug}/`)).text();
    const spanish = await (await request.get(`/docs/es/${slug}/`)).text();
    const explicitAnchors = [...english.matchAll(/<span id="([^"]+)"/g)].map((match) => match[1]);
    for (const anchor of explicitAnchors) {
      if (!spanish.includes(`id="${anchor}"`)) {
        continue;
      }
      expect(languageHref(`https://domfx.dev/docs/${slug}/#${anchor}`, 'es')).toBe(
        `/docs/es/${slug}/#${anchor}`,
      );
      expect(languageHref(`https://domfx.dev/docs/es/${slug}/#${anchor}`, 'en')).toBe(
        `/docs/${slug}/#${anchor}`,
      );
    }
  }
});

test('Spanish documentation links remain usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4347/docs/es/introduction/');
  await page.getByRole('link', { name: 'Instalación', exact: true }).first().click();
  await expect(page).toHaveURL(/\/docs\/es\/installation\/$/);
  await page.locator('[data-language-link="en"]').first().click();
  await expect(page).toHaveURL(/\/docs\/installation\/$/);
  await context.close();
});

test('Spanish Fire lab retains playback, tuning and valid code', async ({ page }) => {
  await page.goto('/docs/es/standalone/');
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-status', 'active');
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText('Activo');
  await lab.getByRole('button', { name: 'Pausar efecto' }).click();
  await expect(lab).toHaveAttribute('data-paused', 'true');
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText('En pausa');
  await lab.getByRole('button', { name: 'Reanudar efecto' }).click();
  await expect(lab).toHaveAttribute('data-paused', 'false');
  await lab.getByRole('slider', { name: 'Fire intensidad' }).fill('45');
  await expect(lab.locator('[data-docs-lab-intensity-code]')).toHaveText('0.45');
  await lab.getByRole('slider', { name: 'Fire altura de las llamas' }).fill('40');
  await expect(lab.locator('[data-docs-lab-height-code]')).toHaveText('40');
  await lab.getByRole('radio', { name: 'SVG' }).check();
  await expect(lab.locator('[data-docs-lab-target="svg"]')).toBeVisible();
  await expect(lab).toHaveAttribute('data-status', 'active');
  expect(await lab.locator('[data-docs-lab-code]').textContent()).toContain('flameHeight: 40');
});

test('Spanish lab explains reduced motion and requires an explicit restart', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/docs/es/api/effects/fire/');
  const lab = page.locator('[data-docs-lab]');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab).toHaveAttribute('data-reason', 'reduced-motion');
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText(
    'La preferencia de movimiento reducido mantiene quieta esta vista previa.',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(lab.locator('[data-docs-lab-status]')).toHaveText(
    'Elige Iniciar efecto para reiniciar esta vista previa.',
  );
  await lab.getByRole('button', { name: 'Iniciar efecto' }).click();
  await expect(lab).toHaveAttribute('data-status', 'active');
});
