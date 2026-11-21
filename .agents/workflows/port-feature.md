---
description: Port a feature from one Phottam platform (web, desktop, PWA) into phottam-platform-kit and replace the copies in the other platforms
---

1. Read `.agents/skills/port-feature/SKILL.md` and follow it from start to finish.
2. Before planning, read `references/architecture.md` and `references/platform-notes.md` in that folder. Use `docs/porting/selection-album-summary.md` as the example of a finished plan.
3. Ask for the feature, the source-of-truth platform and the targets if the request doesn't say.
4. Write the plan to `docs/porting/<feature>.md` and wait for approval before changing code.
5. Build in the kit (types, then logic, then UI state and UI), adopt in the source app, then in the other desktop app, then in the PWA (logic only), and report results for each repo.
