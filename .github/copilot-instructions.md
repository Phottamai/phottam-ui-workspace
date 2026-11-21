# Phottam UI — Copilot Instructions

> Managed centrally in `phottam-ui-workspace`. Edit the copy in the workspace root and run `npm run sync` to distribute updates to all UI repositories.

## Workspace Context

The Phottam UI ecosystem spans six repositories:
- `phottam-website` — Marketing / public website
- `phottam-web` — Core web application
- `phottam-b2b-pwa` — B2B progressive web app
- `phottam-b2c` — B2C customer-facing app
- `phottam-platform-kit` — Shared UI components, design tokens, and utilities
- `phottam-desktop` — Desktop client application

## Shared Engineering Guidelines

- Prefer shared primitives from `phottam-platform-kit` before introducing duplicate UI components.
- Preserve accessibility (semantic HTML, keyboard navigation, ARIA labels) and responsive design across web, PWA, and desktop targets.
- Follow each repository's existing formatting, linting, and testing conventions.
- Do not commit workspace-synced agent files (`.github/agents/`, `.github/instructions/`, `.github/copilot-instructions.md`, `.claude/`, `CLAUDE.md`, `.agents/`, `AGENTS.md`).
