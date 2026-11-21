# Phottam UI — Shared Agent Instructions

> Managed centrally in `phottam-ui-workspace`. Edit in the workspace root and run `npm run sync` to distribute to all cloned repositories.

## Architecture Overview

| Repository | Stack | Role |
| :--- | :--- | :--- |
| `phottam-website` | Next.js 16 + React 19 + Tailwind v4 | Public marketing website |
| `phottam-web` | Next.js 16 + React 19 + Amplify + Vitest | Core web application |
| `phottam-b2b-pwa` | Next.js 16 + React 19 + Amplify + Tailwind v4 | B2B Progressive Web App |
| `phottam-b2c` | Next.js 16 + React 19 + Amplify + Vitest | B2C customer application |
| `phottam-platform-kit` | npm workspaces + React 18 + Vitest | Shared UI kit, types, config, and utilities |
| `phottam-desktop` | Electron + electron-vite + React 18 + Vitest | Desktop application |

## Agent Guardrails

1. Treat each repository under `repos/` as an independent Git repository.
2. Prefer shared packages from `phottam-platform-kit` (`@phottamai/types`, `@phottamai/ui-utils`, `@phottamai/ui-components`, `@phottamai/config`) over duplicating UI code.
3. Do not commit or push changes from the agent flow unless explicitly asked; validate with the repo's lint/test commands and leave Git commits/pushes to the user.
4. Do not commit synced agent files inside individual cloned repos; manage all agent definitions centrally in `phottam-ui-workspace`.

## CodeGraph (When Configured)

When a CodeGraph MCP server (`codegraph_*` tools) is available in the session, prefer it over grep/read loops for structural questions (`codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_trace`, `codegraph_impact`, `codegraph_context`, `codegraph_explore`). Fall back to native search/read for literal text queries or files flagged as pending re-index.
