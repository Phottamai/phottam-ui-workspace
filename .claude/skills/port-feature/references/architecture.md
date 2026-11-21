# Cross-platform feature architecture

How a feature is split so phottam-web, phottam-desktop and Phottam-b2b-pwa can share it through phottam-platform-kit. Repo-specific facts are in [platform-notes.md](platform-notes.md).

## The platforms

| Repo            | Layout     | Framework       | React  | Routing                        | Data fetching                         |
| --------------- | ---------- | --------------- | ------ | ------------------------------ | ------------------------------------- |
| phottam-web     | Desktop    | Next.js 16      | 19     | `next/navigation`, `next/link` | react-query + `src/services/**`       |
| phottam-desktop | Desktop    | Electron + Vite | **18** | `react-router-dom`             | renderer service → IPC → main service |
| Phottam-b2b-pwa | **Mobile** | Next.js 16      | 19     | `next/navigation`              | react-query + `services/**`           |

Web and desktop share desktop layouts, so they share **UI + UI state + logic + types**. The PWA shares **logic + types** and keeps its own UI and UI state.

## The layers

| Layer                                                                    | Kit package                | Path                                                | Consumers    |
| ------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------- | ------------ |
| **Types**: API DTOs, the feature's input model, the shapes logic returns | `@phottamai/types`         | `packages/types/src/dtos/<feature>.dto.ts`          | all          |
| **Logic**: pure functions                                                | `@phottamai/ui-utils`      | `packages/ui-utils/src/<feature>/`                  | all          |
| **UI state**: React hooks for the desktop layout                         | `@phottamai/ui-components` | `packages/ui-components/src/<Feature>/use*State.ts` | web, desktop |
| **UI**: `.tsx`                                                           | `@phottamai/ui-components` | `packages/ui-components/src/<Feature>/*.tsx`        | web, desktop |
| **Platform**: API calls, adapter, container                              | each app                   | next to the feature it replaced                     | per app      |

### Decision rules (one layer per symbol)

- Touches the network, router, URL, toast library, platform components, platform assets or platform model types → **Platform**.
- Pure once `now` and `baseUrl` are passed in, with no React and no DOM → **Logic**.
- React state that only the desktop layout needs (view, hover, filters, copied flags, animation timing) → **UI state**.
- JSX → **UI**.
- Mixed symbols get split:
  - Logic that returns CSS classes → logic returns a `tone` or `level`, and UI maps it to classes.
  - A hook that fetches _and_ derives → the fetch goes to Platform, the derivation becomes a `build*()` in Logic, and leftover state goes to UI state.
  - A component that renders its own modal → the kit renders the content and the platform supplies the frame.

## Layer rules

### Types (`@phottamai/types`)

- API DTOs exactly as the backend returns them (e.g. `SelectionEvent`).
- A **kit-owned input model** with only the fields the feature reads (e.g. `SelectionAlbumSummaryInput`). Store references as `ref` (a slug or id), never as platform objects.
- Reuse existing enums (`ALBUM_STATUS`, `ACTIVITY_TYPE`). Where the API sends strings, use template-literal types: `` `${ACTIVITY_TYPE.ALBUM_SELECT}` ``.
- Shared semantic unions such as `StatusTone`. No React types.

### Logic (`@phottamai/ui-utils`)

- No `react`, `next/*`, router, `window`, `document`, `navigator` or network calls. Guard `atob`.
- Take `now: Date = new Date()` and `baseUrl` as parameters.
- Return meaning (`tone`, `kind`, `level`, numbers), not classes. Short labels that read the same on every platform may stay in logic.
- Derivations become `buildX(input, options) => result`, so both desktop hooks and mobile hooks call the same code.
- When porting an existing pure file, copy it unchanged (`cp`) and edit only its imports. Move its tests with it.

### UI state (`@phottamai/ui-components`)

- Data comes from props. Use one data object per remote resource: `{ events?, isLoading, error?: string | boolean, onRefresh }`. A refresh animation lives in the hook, around `await onRefresh()`.
- State a platform persists or puts in the URL is controlled: `view` + `onViewChange`.
- Runs on React 18.

### UI (`@phottamai/ui-components`)

- Tailwind, `react-icons`, `framer-motion`, `@floating-ui/react`, and kit components (`Tooltip`) only.
- Keep the source's markup and classes verbatim, `dark:` variants included. Consumers scan `node_modules/@phottamai/ui-components/**`.
- Platform pieces become props:

| Need                            | Prop pattern                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modal or drawer frame           | `renderShell({ title, footer, children, onClose })`                                                                                              |
| Links                           | `get*Link(ref, place) => { href?, onClick? } \| null` plus `renderLink?({ link, className, children })`. The default renders `<a>` or `<button>` |
| Toasts                          | `onNotify?(kind, message)`                                                                                                                       |
| Clipboard                       | `onCopy?(text)`, defaulting to `navigator.clipboard`                                                                                             |
| Platform widgets and animations | `ReactNode` slots with a plain default (e.g. `emptyIllustration`, `refreshIndicator`)                                                            |
| Assets                          | URL props (e.g. `fallbackCoverUrl`)                                                                                                              |
| Links built from env or org     | a finished string prop (e.g. `clientLink`)                                                                                                       |
| Time                            | `now?: Date` for tests                                                                                                                           |

- Local `types.ts`, `constants.ts` and `utils.ts` re-export from the packages, so copied files keep their relative imports. Small source helpers that only depend on React and react-icons go in `internal/` (not exported).
- `"use client"` is added to the bundle by `vite.config.ts`, so don't add it per file.

### Platform (each app)

- **API calls follow the source of truth's endpoints.** Targets add a service method (desktop also adds an IPC channel) and delete the old one once nothing uses it.
- An `<feature>.adapter.ts` maps the app's model to the input model, with a test.
- A **container keeps the old component's path and props**, so callers don't change. It holds the data loading, URL/router sync, frame, toasts and slots, and re-exports any helpers other code imported from the old file.
- The mobile app keeps its components, but its hooks call shared logic instead of local copies.

## Versions

- Use one changeset per package: minor for additions, major for breaking changes (a new required peer dependency, or a changed prop meaning).
- Consumers may be several majors behind. Install the local tarballs and run the baseline typecheck _before_ feature edits, so breakage from the version jump is visible on its own.
