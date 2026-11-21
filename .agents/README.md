# Shared Agent Context (`.agents/`)

This directory is the canonical home for cross-tool agent rules, workflows, and skills in `phottam-ui-workspace`:

- `.agents/rules/` — Always-on and scoped coding/testing rules (`phottam-web-code-style.md`, `nextjs-16.md`, `unit-test.md`)
- `.agents/workflows/` — Reusable workflows (`git-commit.md`, `git-pr.md`, `release-notes.md`, `unit-test.md`, `port-feature.md`)
- `.agents/skills/` — Agent skills (`frontend-design`, `modern-web-guidance`, `port-feature`)

Run `npm run sync` from the workspace root to choose your AI framework(s) (`antigravity`, `claude`, `copilot`, `cursor`) and distribute rules and skills to all cloned repositories. `.agents/rules/` and `.agents/skills/` are automatically projected into `.claude/`, `.github/`, and `.cursor/` native formats for whichever frameworks you select (respecting per-repo `excludePaths` and `repo-agents/<repo-name>/` overlays).
