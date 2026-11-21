# Phottam B2B PWA

> Managed centrally in `phottam-ui-workspace` (`repo-agents/phottam-b2b-pwa/AGENTS.md`). Edit in the workspace repo and run `npm run sync`.

## Stack
- Next.js 16 (App Router) + React 19 — read `node_modules/next/dist/docs/` before touching routing or server components
- TailwindCSS for all styling — no inline styles, no CSS modules
- TanStack Query v5 for all server state
- react-hook-form + yup for all forms
- flowbite-react 0.10.2 — UI primitives only; never use Flowbite Modal/Popover/Drawer for dialogs or overlays

## PWA-First UI
This is a mobile PWA, not a web dashboard.
- Use bottom-sheet drawers, not modals, for overlays and confirmations
- Use `dvh` units for height (not `vh`)
- Touch targets minimum 44px tall
- No hover-only interactions

## Use These Layouts — Don't Reinvent

| Use case | Component |
|---|---|
| Page with header + search + pagination | `@/components/PwaListingLayout` |
| Simple page with title + actions | `@/components/MobilePageLayout` |
| Bottom-sheet drawer | `@/components/Drawer/PwaDrawer` |
| Any confirmation or destructive action | `@/components/Client/ActionConfirmationDrawer` |
| Empty state | `@/components/EmptyState` |
| Loading skeletons | `@/components/SkeletonLoader` |
| Buttons | `@/components/Button` |

## Confirmation Dialogs — Strict Rule
`ActionConfirmationDrawer` is the **only** confirmation component. Use it for every delete, destructive, or irreversible action.

```ts
{ isOpen, onClose, onConfirm, title, description, confirmText,
  cancelText?, isLoading?, variant?: "danger"|"success"|"warning"|"primary", icon? }
```

**These were deliberately deleted — do not recreate:**
- `ConfirmationModal/` — Flowbite Modal-based
- `DeleteConfirmationModal/` — createPortal drawer
- `ConfirmationButton/` — Flowbite Popover inline confirm
- `ConfirmationAlert/` — Flowbite fixed overlay
- `(SmartFaces)/ConfirmationModal.tsx` — local SmartFaces modal

`DeletionModal` is kept but is Memory Box soft-delete only — not general purpose.

## High-Risk Areas — Extra Care
- Auth flows (Amplify) — touch only when explicitly required
- `app/layout.tsx` — affects every page
- `next.config.ts` — affects the whole build
- Service worker / PWA manifest — affects install and offline behavior

## Workspace Guardrails
- Prefer shared packages from `phottam-platform-kit` (`@phottamai/types`, `@phottamai/ui-utils`) over duplicating types or pure business logic.
- Do not commit or push changes from the agent flow unless explicitly asked; validate with lint/build and leave Git commits/pushes to the user.
- Do not commit synced agent files inside this repo; manage all agent definitions in `phottam-ui-workspace`.
- When CodeGraph MCP (`codegraph_*` tools) is configured in the session, prefer it over grep/read loops for structural queries.
