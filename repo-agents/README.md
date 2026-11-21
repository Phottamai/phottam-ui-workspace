# Repo-Specific AI Agent Overlays

Place repository-specific agent files under `repo-agents/<repo-name>/` using the same relative paths as the target repository.

## Example Layout

```text
repo-agents/
├── phottam-desktop/
│   ├── CLAUDE.md                                     # Replaces shared CLAUDE.md in phottam-desktop
│   ├── .github/agents/electron-ipc.agent.md          # Added alongside shared Copilot agents
│   └── .claude/agents/desktop-packager.md            # Added alongside shared Claude agents
├── phottam-platform-kit/
│   └── .agents/skills/design-tokens/SKILL.md         # Added alongside shared skills
└── phottam-b2b-pwa/
    └── .github/instructions/pwa-offline.instructions.md
```

## Sync Rules

When `npm run sync` runs:
1. Shared paths from the workspace root are synced into each cloned repo first.
2. Any files inside `repo-agents/<repo-name>/` are overlaid on top:
   - **New files** inside agent folders (e.g., `.github/agents/`, `.claude/agents/`, `.agents/skills/`) are added alongside shared ones.
   - **Matching filenames** (e.g., `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, or a shared agent file) **replace** the shared version for that repo only.
3. All synced files (both shared and repo-specific) are automatically excluded by that repo's managed ignore block and cleaned up by `npm run clean:agents`.
