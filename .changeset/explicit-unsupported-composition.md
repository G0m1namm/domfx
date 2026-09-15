---
'@domfx/browser': patch
'@domfx/core': patch
---

Report unsupported initial transforms through unavailable handles and add the
`unsupported-composition` reason for target/intermediate opacity, filters and blending.
Check pending initialization and refresh so detected invalid composition cannot be
revived by late work. Document the bounded detection rules and caller obligations.
