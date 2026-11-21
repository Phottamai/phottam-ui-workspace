@AGENTS.md

# Phottam UI — Claude Code Context

> Managed centrally in `phottam-ui-workspace`. Edit this file in the workspace root (or add a repo-specific override in `repo-agents/<repo-name>/CLAUDE.md`) and run `npm run sync`.

## Working Conventions

- Follow all guidelines in `AGENTS.md` and `.agents/rules/`.
- Reuse components and helpers from `phottam-platform-kit` wherever applicable.
- Keep edits scoped to the target repository; each cloned repo maintains its own independent Git history.
- Never commit synced agent context files inside individual cloned repos — update them in `phottam-ui-workspace` and run `npm run sync`.
