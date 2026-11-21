---
name: port-feature
description: Port a feature built in one Phottam platform (phottam-web, phottam-desktop, Phottam-b2b-pwa) into phottam-platform-kit and replace the copies in the other platforms. Splits the feature into types, pure business logic, UI-state hooks and UI. Desktop platforms share all four layers; the mobile PWA shares types and logic only. API calls stay in each app and follow the source platform's endpoints. Use when asked to port, share, move to the kit, de-duplicate, or sync a component or feature across web, desktop and the PWA.
---

# Port a feature across Phottam platforms

This skill works in any agent that reads `SKILL.md` folders: Claude Code (`.claude/skills/port-feature`) and Antigravity (`.agents/skills/port-feature`, `/port-feature` workflow). It is managed at the `phottam-ui-workspace` root and synced to all repositories.

Before starting, read these two references:

- [references/architecture.md](references/architecture.md): the contract every port must follow. It covers the layers, where each one lives, the import rules, and the data and slot patterns.
- [references/platform-notes.md](references/platform-notes.md): repo-specific facts and traps (IPC on desktop, API base paths, Tailwind tokens, React 18, tooling quirks). Every item in it was hit during a real port.

`docs/porting/selection-album-summary.md` is a complete worked example. Read it to see what a finished plan looks like.

## Inputs

Ask the dev for these if the request doesn't say:

1. **Feature and entry point**, e.g. a component path or a UI string.
2. **Source of truth**: web, desktop or pwa. Its UI, behaviour **and API endpoints** win. Other platforms switch to its endpoints.
3. **Targets**: by default, the two other platforms.

## 0. Set up the workspace

You need all four checkouts side by side (in `phottam-ui-workspace`, they already live as siblings under `repos/`):

- `repos/phottam-platform-kit`
- `repos/phottam-web`
- `repos/phottam-desktop`
- `repos/phottam-b2b-pwa`

The kit's `export:tar` script expects them to be siblings.

- **From `phottam-ui-workspace` root (recommended):** open `phottam-ui-workspace` directly in Claude Code or Antigravity — all four repos under `repos/` and the `port-feature` skill are available immediately.
- **Standalone checkout:** start in `phottam-platform-kit` and run `claude --add-dir ../phottam-web --add-dir ../phottam-desktop --add-dir ../phottam-b2b-pwa` (or open all four folders in your workspace).

If a repo is missing, ask for its path.

In each repo, run `git status` and `git branch --show-current`. Never work on `main` or `develop`. Create `feature/port-<feature>` in each repo before its first edit. Leave unrelated untracked files alone. If a repo's `AGENTS.md`/`CLAUDE.md` has framework notes (e.g. the Next.js 16 docs warning), follow them in that repo.

## 1. Discover (read-only)

1. In the source repo, map the import graph from the entry component. Use `grep -rhoE "from ['\"][^'\"]+['\"]"` and quote globs, because the shell is zsh. Follow relative imports, plus feature-specific `@/` imports. Note each file's line count.
2. List every caller **outside** the feature folder. Also list everything **inside** the feature that other code imports (types, helpers like `getDueStatusTag`). Those exports must keep working.
3. Find the counterparts in each target. Grep for component and hook names, UI strings and endpoint paths. For each target, record its **data source (endpoint)**, model type, router, modal component, toast API and data-fetching style.
4. List the source's platform dependencies: components (`@/components/*`), assets under `public/`, custom Tailwind tokens (`font-*`, `ph-*`, `animate-*`), libraries that aren't kit peer dependencies, and React 19-only APIs.
5. Read the kit's current layout, and the `News` and `SelectionAlbumSummary` folders as examples.

## 2. Write the plan and stop

Create `docs/porting/<feature-kebab>.md` in the kit from [references/plan-template.md](references/plan-template.md).

- Give every symbol a layer, using the decision rules in the architecture doc. Split anything mixed: a hook that fetches and derives, logic that returns CSS classes, or a modal that owns its own frame.
- Define the **input model**: only the fields the feature reads, never a platform's full type.
- For each target, say which endpoint it must call after the port and what is added or removed (service method, IPC channel, react-query hook).
- List each platform dependency and how it is replaced: slot, callback, kit internal, or a token added to the consumer's Tailwind config.
- If the source is the **mobile PWA**, only types and logic can be shared. Ask how the desktop UI should be produced.
- Risks: backend access to the endpoint from each target, version jumps in the kit dependencies, visual differences.

**Show the plan to the dev and wait for approval.**

## 3. Build in the kit

Work in this order and build after each package (`npm run build` builds config → types → ui-utils → ui-components):

1. **Types** go in `packages/types/src/dtos/<feature>.dto.ts`, exported from `dtos/index.ts`.
2. **Logic** goes in `packages/ui-utils/src/<feature>/`, with `index.ts` exported from `src/index.ts`.
   - When the source already has a pure utils file, copy it with `cp` and edit only its imports. That keeps the logic byte-identical.
   - Move the source's unit tests next to it as `*.test.ts`, and add tests for every extracted function.
3. **UI state and UI** go in `packages/ui-components/src/<Feature>/`.
   - Copy the `.tsx` files with `cp`, then replace only the platform imports.
   - Add local `types.ts`, `constants.ts` and `utils.ts` files that re-export from the packages. Then the copied files' `./types`, `./utils` and `./constants` imports keep working unchanged.
   - Small source helpers that only depend on React and react-icons go in `internal/` (not exported).
   - Platform widgets and assets become slots.
   - Port the source's component tests, passing data through props instead of mocking the API.
4. Run `npm test`, `npx tsc --noEmit -p packages/<pkg>`, `npm run lint` and `npx prettier --write <changed paths>`.
5. Add one changeset per package in `.changeset/*.md`: minor for additions, major for breaking changes. A new required peer dependency or a changed prop meaning counts as major.

Check these rules before moving on:

- Kit feature code has no `next/*`, `react-router-dom`, `@/…`, `@renderer/…`, `flowbite-react`, `react-toastify`, `axios` or fetch calls.
- Logic never calls `window`, `document`, `navigator` or `new Date()` directly. Pass them in, or default an optional `now` parameter.
- Hooks get data through props. Any state a platform persists or syncs to the URL is controlled with `value` + `onChange`.
- Code runs on React 18: no `use()`, no `inert` prop, no ref-as-prop, no `useActionState` or `useOptimistic`.
- A new peer dependency needs the dev's approval and must also be installed in every consumer.

## 4. Adopt in each app

Order: source repo → the other desktop-layout repo → PWA (logic only). For each repo:

1. **Install the local kit.** From the kit root, run `node scripts/export-tarball.mjs <types|ui-utils|ui-components> <repo-folder>` for each changed package, then `npm install` in the app. This needs the user's npm cache or `NODE_AUTH_TOKEN` for GitHub Packages. If the sandbox blocks `~/.npm`, ask before running outside it.
2. **Check the baseline first.** Typecheck right after installing, before any feature edit. Fix breakage caused by the kit version jump, or report it if it's large. See platform-notes for each repo's typecheck command and its pre-existing errors.
3. **Write the platform layer:**
   - An adapter `<feature>.adapter.ts` that maps the platform model to the input model, with a test.
   - Data loading with the source's endpoint: react-query in web and the PWA, a service plus hook in desktop (desktop needs an IPC channel too).
   - A container that keeps the **old component's path and props**, so callers don't change. It wires router/URL state, the modal frame, toasts, clipboard and slots.
   - Re-export any helpers other code imported from the old files.
4. **Delete the replaced files**, plus any old service methods, IPC channels and types that only they used. Grep to confirm nothing still references them.
5. **Verify:** run tests (the moved component tests now go through the container), the typecheck compared against the baseline, lint on changed files, and a production build for apps that render kit UI. Then do a manual check in the running app.

## 5. Report

For each repo, report:

- the branch name and files changed;
- test, typecheck, lint and build results, including any pre-existing failures and the evidence that they're pre-existing;
- what wasn't verified, especially a manual UI check if none was done;
- follow-ups: publish the kit with its changesets, replace the `file:./local_packages/*.tgz` dependencies with published versions before merging, and get backend confirmation for any endpoint a target newly uses.

Commit only when the dev asks. Use one PR per repo, kit first, and say which kit version each app PR needs.
