# Artifact and documentation policy

This policy defines publication boundaries, artifact durability, document formats,
and the evaluation of vendored skills for domfx.

## Publication boundaries

1. **Durable contributor knowledge vs. local operational state:**
   - Durable knowledge belongs in tracked documentation (`README.md`, `CONTRIBUTING.md`,
     `GLOSSARY.md`, `HARNESS.md`, `engineering/`) or linked GitHub issues.
   - Personal working notes, transient experiment runs, session history, and machine-local
     settings stay in ignored locations (`.scratch/`, `PROJECT_CONTEXT.md`, local `docs/`,
     `.env*.local`). Never commit or require them.
   - A local-only log must not be the sole evidence needed to understand or reproduce
     a public contract.

2. **Pushed branches are published to the repository audience:**
   - Any branch pushed to the remote repository is available to its current audience,
     even if it is never merged to `main`, and can become public if visibility changes.
   - Never push credentials, tokens, raw memory dumps, or sensitive personal data.
   - Publish selected, sanitized non-design research evidence only when its question,
     method, limits, immutable source revision, and reader are clear. Link its commit
     and entry path from the issue. Keep design exploration prototypes, comparison
     boards, screenshots, and visual baselines local; record approved conclusions in
     `DESIGN.md` or the issue.

3. **Repository visibility vs. package distribution:**
   - GitHub source visibility and npm distribution are distinct boundaries.
   - Package manifests select `dist` via `files: ["dist"]`; npm tarballs also include
     package metadata, README, license, and an optional changelog, as allowed by
     `scripts/check-release-artifacts.mjs`. Other tracked documentation is excluded.

4. **Package-private fixtures vs. confidential source:**
   - `tests/gpu` is a package-private workspace for internal regression testing.
   - In a public repository, the source code of `tests/gpu` is publicly viewable,
     but it is not a published package or public demo gallery. Never store credentials
     or confidential data in test fixtures.

5. **Human contributor usability:**
   - The contributor workflow is fully functional without AI clients or agents.
   - Standard commands (`pnpm install --frozen-lockfile`, `pnpm check`, `pnpm demo`,
     `pnpm test:web:smoke`) and GitHub issues provide a complete human contribution path.
   - The agent harness (`pnpm agent:brief`, `pnpm agent:verify`) automates these existing
     checks and records local snapshots for agent runs; it does not replace the human path.

## Audience, location, and format map

| Category                                       | Audience                      | Primary location                                                                                       | Format and rules                                                                                                                                | Durability             |
| ---------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Root contributor guides                        | Human contributors & agents   | `README.md`, `CONTRIBUTING.md`, `HARNESS.md`, `AGENTS.md`                                              | Concise entry points with clear reader paths; link canonical docs rather than repeating long instructions                                       | Permanent / Tracked    |
| Domain terminology                             | All contributors & agents     | `GLOSSARY.md`                                                                                          | Canonical glossary; term in bold, concise definition, and optional `_Avoid_` synonym                                                            | Permanent / Tracked    |
| Design direction                               | UI/web contributors & agents  | `DESIGN.md`                                                                                            | Approved visual tokens, layout and interaction rules, and terminology links; exploration artifacts stay local                                   | Permanent / Tracked    |
| Architecture decisions                         | Maintainers & contributors    | `engineering/adr/NNNN-slug.md`                                                                         | Created lazily for durable tradeoffs. Title and context/decision/reason paragraph; consequences optional                                        | Permanent / Tracked    |
| Engineering investigations                     | Maintainers & contributors    | `engineering/*.md`                                                                                     | Curated decisions and reproducible methods with dated, bounded evidence                                                                         | Permanent / Tracked    |
| Agent workflow & skills                        | Agents & orchestrators        | `engineering/agent-workflow.md`, `engineering/skills.md`, `.agents/skills/*`                           | Standard `SKILL.md` with YAML frontmatter, clear context pointers, and upstream licenses/provenance                                             | Permanent / Tracked    |
| Issue tracker & specs                          | Contributors & maintainers    | GitHub Issues                                                                                          | Canonical backlog. Parent specs (`spec`), independent vertical slices (`ready-for-agent`, `ready-for-human`), task brief, and acceptance checks | Permanent / Remote     |
| Package contracts                              | Library consumers             | `packages/*/README.md`, `QUICKSTART.md`                                                                | Supported APIs, options, lifecycles, and verified examples                                                                                      | Permanent / Tracked    |
| Package-private fixtures                       | Contributors & CI             | `tests/gpu/`                                                                                           | Internal regression tests and diagnostic cases; never published to npm                                                                          | Permanent / Tracked    |
| Repository settings                            | Maintainers                   | `.github/REPOSITORY_SETTINGS.md`                                                                       | Shared repository settings, branch protection, release gates, and maintenance routines                                                          | Permanent / Tracked    |
| Transient working notes and design exploration | Individual maintainer / agent | `.scratch/`, `PROJECT_CONTEXT.md`, local `docs/`, `engineering/design-explorations/`, visual baselines | Scratch notes, raw logs, profiling traces, prototypes, comparison boards, and screenshots; ignored by Git                                       | Ephemeral / Local only |

## Document format conventions

- **GLOSSARY.md:** Single canonical domain glossary. Keep definitions concise and include
  `_Avoid_` aliases where domain ambiguity exists. Do not create secondary glossaries.
- **ADRs (`engineering/adr/NNNN-slug.md`):** Create lazily when a real architectural
  tradeoff arises. A title plus a context/decision/reason paragraph is sufficient;
  add consequences when useful. Avoid large empty templates for minor or obvious choices.
- **Research and evaluation records:** State the question, dated source commit, environment,
  primary observations, recommendation/decision, and limits. Promote only durable findings;
  keep raw per-run logs in ignored local locations.
- **Task briefs and PRs:** Keep task scope, non-goals, and observable acceptance checks
  in the linked GitHub issue. PR descriptions cite the issue, summarize changes, record
  reproducible evidence, and state unverified scope.

## Skill availability: vendored copies vs. pinned bootstrap

The repository includes the full 27-skill AI Hero engineering and productivity catalog
alongside 5 project specialist skills.

| Approach                                     | Advantages                                                                                                                       | Disadvantages                                                                                                                                                                                   | Decision    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Pinned bootstrap script** (fetch on setup) | Smaller initial repository footprint; decouples skills from Git tracking                                                         | Requires external network connectivity during setup; susceptible to upstream host downtime or API changes; complicates offline and fresh-clone workflows; requires custom bootstrapping scripts | Rejected    |
| **Vendored copies in `.agents/skills/`**     | Fresh-clone usable immediately; preserves repository-specific adaptations and upstream licenses/provenance without a setup fetch | Tracks 27 skill directories in source control; updates need review                                                                                                                              | **Adopted** |

**Tradeoff decision:**
Retain vendored copies in `.agents/skills`. All 27 AI Hero skills and their upstream
MIT licenses are preserved at pinned commit `49dd158d1076134a641b33efb035946536778336`
(manifest: [engineering/aihero-skills.json](aihero-skills.json)). Specialist skills
and licenses are preserved as documented in [engineering/skills.md](skills.md).
The reviewed public repositories track project-specific skills, but do not include a
full generic catalog; their global installations are unknown. Keep this repository's
approved 27-skill availability without requiring a personal/global installation.

## Existing file disposition

| Files or category                                                                                                                                               | Decision                                      | Reason                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `README.md`, `QUICKSTART.md`, package READMEs                                                                                                                   | Keep                                          | Reader path and consumer contracts                                                            |
| `AGENTS.md`, `CONTRIBUTING.md`, `HARNESS.md`, `engineering/agent-workflow.md`, `engineering/task-brief.md`                                                      | Keep with links to canonical guidance         | Agent routing, human workflow, executable checks                                              |
| `GLOSSARY.md`; former `CONTEXT.md`                                                                                                                              | Keep glossary; remove former terminology copy | One canonical domain vocabulary                                                               |
| `DESIGN.md`, `engineering/agents/`, `.github/` contributor files                                                                                                | Keep                                          | Approved design and shared tracker/repository configuration                                   |
| `engineering/browser-tooling-evaluation.md`, `engineering/layout-allocation-investigation.md`, `engineering/references.md`, `engineering/harness-evaluation.md` | Keep dated, bounded decisions and methods     | No-go conclusions remain useful; historical measurements do not establish current performance |
| `.agents/skills/`, `engineering/aihero-skills.json`, `engineering/skills.md`                                                                                    | Keep pinned copies and provenance             | Fresh-clone access to all 27 skills and project specialists                                   |
| `.scratch/`, `PROJECT_CONTEXT.md`, local `docs/`, design explorations and visual baselines                                                                      | Local only                                    | Personal or raw evidence; publish durable conclusions in issues/tracked guidance              |

Retain the dated measurements in the two investigation records as historical evidence,
with their original environment and limits. The current verification contract is in
`CONTRIBUTING.md` and `HARNESS.md`; these older results are not release evidence.
