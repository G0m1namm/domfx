# Shared site resources

`@domfx/site` is a private workspace package for the marketing and documentation apps.
It is never published and is not part of the library API.

- `effects`, `effect-reference` and `site-links` export shared content.
- `components/*.astro` export SiteNav, its search trigger and the Phosphor sprite.
- `styles/*.css` export DESIGN tokens, fonts, brand treatments and shared chrome styles.
- `public-path` exports `sitePublicDir` for each Astro app's `publicDir` configuration.
  Fonts, licenses, favicon and brand mark keep their root URLs, including `/fonts/`.

SiteNav accepts `current`, `decorated` and a named `search` slot. Its default search
trigger works with the marketing dialog; docs can supply Starlight's search control.
