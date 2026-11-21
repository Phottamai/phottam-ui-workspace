# phottam-platform-kit

Shared packages for phottam-web, phottam-desktop and Phottam-b2b-pwa: `@phottamai/types`, `@phottamai/ui-utils`, `@phottamai/ui-components` and `@phottamai/config`. `@phottamai/notifier-contracts` is the exception: a backend package (zod contracts and an SQS producer client) for the notifier service and its producers, not the frontends.

- **Agents overview:** `.agents/README.md`.
- **Porting a feature between platforms:** use the `port-feature` skill (`.agents/skills/port-feature/SKILL.md` / `.claude/skills/port-feature/SKILL.md`) or run the `/port-feature` workflow from the workspace root.
- **Layering:** types go in `types`, pure logic in `ui-utils`, and React state and UI in `ui-components`. API calls stay in the apps (except the SQS client in `notifier-contracts`). See `.agents/skills/port-feature/references/architecture.md`.
- **Checks:** `npm run build`, `npm test`, `npm run lint`, `npm run format:check`. Every package change needs a changeset (`npm run changeset`).
