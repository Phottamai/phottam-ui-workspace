# Porting plan: <Feature name>

- **Source of truth:** <repo> @ <branch/commit>, `<path>`
- **Targets:** <repos> (say for each one whether it takes UI + state + logic, or logic only)
- **Kit packages touched:** types / ui-utils / ui-components
- **Status:** Draft, waiting for dev approval

## 1. Scope

The entry components in the source repo and every file reachable from them (with line counts). Also list files explicitly **out of scope** and why.

## 2. Existing counterparts in target repos

| Target | Files that will be replaced | Differences in behaviour or data source |
| ------ | --------------------------- | --------------------------------------- |

Call out any target that gets its data from a **different endpoint** or a different model type than the source.

## 3. Layer classification

One row per exported or internal symbol. Every symbol needs a row.

| Symbol | Source file | Layer (Types / Logic / UI state / UI / Platform) | Kit destination | Change needed when moving |
| ------ | ----------- | ------------------------------------------------ | --------------- | ------------------------- |

"Change needed" covers things like: inject `now`, inject `baseUrl`, return a tone instead of classes, split out a pure derivation, make the state controlled, or replace a platform import with a slot.

## 4. Data contract

- Input model (`<Feature>Input`) with fields, and how each target maps onto it.
- API DTOs, and which endpoint each target must call (new service methods to add).
- Props of each kit component and hook: data, loading/error, callbacks, slots.

## 5. Platform dependencies to inject

| Source import | Replaced by (slot / callback / kit component / dropped) |
| ------------- | ------------------------------------------------------- |

## 6. Tests

Which source tests move into the kit, which stay in the source repo (adapter/container), and which new tests are needed.

## 7. Steps and PRs

1. Kit PR: types + logic (+ changeset)
2. Kit PR: UI state + UI (+ changeset)
3. Source repo PR: adopt the kit, delete the local copies, keep tests green
4. Desktop-sibling PR: adopt the kit, delete the old copy
5. Mobile PR: adopt the logic only, delete duplicated logic

## 8. Risks and open questions
