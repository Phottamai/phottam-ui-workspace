# GitHub Copilot Custom Agents

Place Copilot custom agent definitions (`*.agent.md`) in this directory inside `phottam-ui-workspace`.

When you run `npm run sync` from the workspace root, everything in `.github/agents/` is mirrored into each cloned repository's `.github/agents/` directory (without touching repo-owned `.github/workflows/` or other GitHub files).
