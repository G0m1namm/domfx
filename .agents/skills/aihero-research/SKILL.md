---
name: aihero-research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Read the [domfx integration](../../../engineering/agent-workflow.md#repository-integration) before running this skill.


If running in the primary session, spin up one **background agent** with a bounded question and output path, so you can keep working. If already running as that research subagent, do the research yourself; do not delegate it again.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.
