# @domfx/core

DOM-independent domfx capture and effect handle contracts, plus alpha classification.

Experimental package; `0.1.0-alpha.1` is available on npm. The experimental browser attachment implements
`EffectHandle`, extending the `ManualEffectHandle` controls with external time control (`clock: 'manual'`) or automatic animation (`clock: 'auto'`,
with `'ambient'` retained for compatibility), plus pause/resume; core accepts no DOM elements or animation-library objects.

See the [project README](https://github.com/G0m1namm/domfx#readme) for development
instructions and current limitations. MIT licensed; see LICENSE in the package.
