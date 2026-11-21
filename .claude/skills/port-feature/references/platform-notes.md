# Platform notes

Facts and traps per repo, learned from real ports. Check them during discovery and adoption, and add to this file when a port turns up something new.

## phottam-platform-kit

- **Packages and build order:** `npm run build` builds config → types → ui-utils → ui-components. `ui-utils` depends on `@phottamai/types` (peer); `ui-components` depends on both.
- **Tests:** vitest at the root (`npm test`, `vitest.config.ts`). Projects: `ui-utils` runs in node, `ui-components` in jsdom with `@testing-library/react`. Tests live next to the source as `*.test.ts(x)` and are excluded from `.d.ts` output. CI runs `npm test` in the quality gate.
- **Externals:** `vite.config.ts` must list every peer dependency (including `react-icons` and `/^react-icons\//`, plus `@floating-ui/react`). Anything missing gets bundled into `dist`.
- **Tooltip:** the kit `Tooltip` is the floating-ui Tooltip from web (`content`, `placement`, `style`, `trigger`, …). Use it instead of a platform tooltip.
- **Optional peer dependencies:** keep code that imports an optional peer (e.g. `@microsoft/clarity`) out of a package's main entry. Give it a subpath entry (`@phottamai/ui-utils/clarity`), because Next.js/Turbopack resolves even dynamic `import()`s and fails when the peer isn't installed. `exceljs` is still imported by the main `ui-utils` entry; all three apps install it today.
- **Shared images:** `packages/ui-components/images/` is published (`exports['./images/*']`). Noro mascots are in `images/noro/`. Desktop (Vite) imports `@phottamai/ui-components/images/noro/<file>.png` directly. Web copies kit image folders into `public/` via `scripts/copy-kit-icons.js` (gitignored output) and uses `/noro/<file>.png`. Kit components take image URLs as props; they never hard-code paths.
- **Local install:** `node scripts/export-tarball.mjs <package> <repo-folder>` builds and packs the package, copies it to `<repo>/local_packages/` and rewrites the app's `package.json` to `file:./local_packages/…tgz`. Then run `npm install` in the app. Never merge those `file:` dependencies: switch to the published version first. web ignores `local_packages/`; desktop and the PWA don't.
- **Publishing:** add one changeset per package (`.changeset/*.md`). CI opens the version PR.

## phottam-web (source of truth for desktop UI so far)

- Next.js 16 App Router, React 19, Tailwind 3, react-query, `react-toastify`, `flowbite-react`.
- **API:** `src/services/**` static classes on `apiClient`, whose base URL **already ends in `/api`** (`envConfig.NEXT_PUBLIC_API_ENDPOINT`). So paths look like `/album/:id/...`.
- **Theme tokens** in `tailwind.config.ts`: `ph-dark`, `ph-dark-lite`, `ph-border-dark`, `font-dmsans`, `animate-loader-pop`, `animate-loader-rise`, `animate-loader-float`, `animate-mood-bob`, the `gradientShift` keyframes, etc. Before porting UI, grep the copied files for every `animate-*` and `ph-*` class and check each exists in desktop's config, or add it there. Fonts are the exception: leave `font-*` classes unmapped on desktop so kit UI uses desktop's own font (Plus Jakarta Sans). Web keeps its DM Sans.
- **Public assets** (e.g. `/couple_cartoon.jpg`) don't exist in desktop. Pass them as props or slots, never as hard-coded paths in the kit. Grep copied `.tsx` files for `src="/` before finishing. Images shared by both apps belong in the kit's `images/` folder (as `images/noro/` does).
- **Typecheck:** `npx tsc --noEmit -p . --ignoreDeprecations 6.0` (TS 6). There are ~480 pre-existing errors and `next.config` has `ignoreBuildErrors: true`, so compare the error count before and after, and filter to the files you touched.
- **Tests:** `npx vitest run` (jest-dom matchers available). Some suites already fail on `develop`; check that a failing assertion isn't stale before blaming the port.
- **Build:** `npx next build`.

## phottam-desktop

- Electron + electron-vite, **React 18**, Tailwind 3 with `darkMode: 'class'`, `react-router-dom`, **no react-query**.
- **API calls go over IPC.** The renderer service calls `apiClient.request('<channel>', ...args)` (`src/renderer/src/service/*.service.ts`). The main process registers `ipcMain.handle('<channel>', handler)` (`src/main/src/<area>/<area>Handler.ts`), and the handler calls a main service (`<area>Service.ts`) using `get/post` from `common/service/apiClient`. The base URL has **no `/api`**, so web's `/album/x` becomes `/api/album/x` here. There's no channel allowlist in preload.
- **Modal frame:** `@renderer/components/Modal/ModalWindow` (`isOpen`, `onClose`, `title`, `footer`, `maxWidth`, `portal`, …).
- **Navigation:** `navigateToEntity(navigate, location, path, { returnState })` from `@renderer/utils/navigationState`. Links are click handlers, not hrefs.
- **Client links:** `getSelectionAlbumClientLink(album, org)` / `getOrgWebBaseUrl(org)` from `@renderer/utils/album.utils`. These handle branded domains, so never use `window.location.origin`.
- **Toasts:** a `showToast(title, type, message)` prop passed down from pages.
- **Typecheck:** `npm run typecheck` (node and web projects). It is clean, so keep it at zero errors.
- **Lint:** `npx eslint --resolve-plugins-relative-to node_modules/@electron-toolkit/eslint-config-ts <files>`. Plain `npm run lint` can't find the TS plugin. The big service and handler files have many pre-existing errors, so check only the lines you changed.
- **Build:** `npx electron-vite build --mode development`.
- **No React testing library:** desktop has no `@testing-library/react` or jsdom, so renderer hooks and components can't be unit tested without adding them. Put testable logic in the kit.

## Phottam-b2b-pwa (mobile)

- Next.js 16 App Router (`app/` at the repo root), React 19, **Tailwind 4**, react-query.
- Shares **types and logic only**. Keep its mobile components and UI state, and reduce its hooks to state plus calls into `@phottamai/ui-utils`.
- **API:** `services/**` on `apiClient`, whose base URL ends in `/api` (same paths as web).
- **Typecheck:** `npx tsc --noEmit -p .` (TS 5; `--ignoreDeprecations 6.0` is rejected). There are ~270 pre-existing errors, so compare counts and filter to touched files.
- **Lint:** `npx eslint <files>`.
