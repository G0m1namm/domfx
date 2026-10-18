# Domain documentation

This repository uses one shared [GLOSSARY.md](../../GLOSSARY.md). Read it before
exploring domain behavior; use its terms in discussions, tests, issues, and code.
The packages share one domain, so the monorepo alone does not require multiple
context glossaries or a glossary map.

Keep the glossary to domain definitions and explicitly avoided synonyms. Record
implementation contracts and acceptance checks in the relevant GitHub issue.
Read [CONTRIBUTING.md](../../CONTRIBUTING.md) for package boundaries and ownership
requirements, and [DESIGN.md](../../DESIGN.md) before visual decisions.

Create `engineering/adr/NNNN-slug.md` lazily for a real, durable architectural tradeoff
using the domain-modeling skill’s ADR format. Read relevant ADRs when present;
otherwise proceed. Surface conflicts rather than silently reversing a decision.

`PROJECT_CONTEXT.md`, `docs/`, and `.scratch/` are optional local notes. They are not
required inputs for contributors, and are not copied into tracked documentation.
When earlier work refers to `CONTEXT.md`, use `GLOSSARY.md`, which preserves those
definitions. Do not recreate a second glossary.
