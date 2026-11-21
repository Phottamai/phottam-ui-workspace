---
description: Create comprehensive pull request descriptions comparing current branch with develop
---

# Pull Request (PR) Generator

This workflow analyzes differences between the current branch and the `develop` branch to generate a production-ready Pull Request title and description adhering to the team's Pull Request Guidelines.

## Guardrails

- Base/target branch defaults to `develop` (can be configured or overridden to `main` or another branch if specified).
- Analyze both committed deltas (`develop..HEAD`) and staged/working directory changes when relevant.
- Do not modify source code or perform `git commit` / `git push` during this workflow.
- Ensure all guidelines are strictly adhered to in the generated PR output.

## Pull Request Guidelines

Every PR should include:

- **A clear and meaningful title.**
- **A brief summary explaining what changed and why.**
- **A list of the major changes included.**
- **The related issue, ticket, or task number.**
- **Testing details (what was tested and how).**
- **Screenshots or screen recordings for any UI changes.**
- **Confirmation that the code has been reviewed, debug code has been removed, and the PR is ready for review.**

Following these guidelines helps reviewers understand changes quickly, reduces review time, and maintains a high-quality codebase.

## Steps

### 1. Analyze Branch Differences

Gather the difference between the current branch and `develop`:

1. **Check Current Branch & Status**:

   ```bash
   git rev-parse --abbrev-ref HEAD
   git status --short
   ```

2. **Commit History**:

   ```bash
   git log origin/develop..HEAD --oneline || git log develop..HEAD --oneline
   ```

3. **Changed Files Summary**:

   ```bash
   git diff --stat origin/develop...HEAD || git diff --stat develop...HEAD
   ```

4. **Review Detailed Changes**:
   ```bash
   git diff origin/develop...HEAD || git diff develop...HEAD
   ```
   Inspect key logic, API, UI, styles, or configuration deltas.

### 2. Gather Context & Metadata

If not obvious from commits or branch name, ask/confirm:

- Related issue / ticket / task number (e.g. Jira, GitHub issue, or internal ID).
- Any specific testing instructions or environments (e.g. staging, local dev).
- UI assets (screenshots/recordings) if frontend changes were made.

### 3. Generate PR Content

Format the PR title and description using the standard template below:

#### PR Title Format:

`<type>(<scope>): <clear and meaningful description in imperative mood>`
_Examples:_

- `feat(quotations): add border styling to three-dot action menu`
- `fix(incomes): standardize edit button icon with manage quotations`
- `refactor(templates): migrate meta image upload to presigned S3 URL`

#### PR Description Template:

```markdown
## 📋 Summary

<!-- A brief summary explaining what changed and why -->

<1-3 concise sentences explaining the problem addressed, the rationale behind the solution, and the functional outcome.>

## 🚀 Major Changes

<!-- A list of the major changes included -->

- **<Area / Component 1>**: <Description of key change>
- **<Area / Component 2>**: <Description of key change>
- **<Area / Component 3>**: <Description of key change>

## 🔗 Related Issue / Ticket

<!-- The related issue, ticket, or task number -->

- Closes #<issue-number> / [TICKET-<id>](link-to-ticket)
- _If no linked ticket, specify: `N/A`_

## 🧪 Testing Details

<!-- What was tested and how -->

- **Automated Tests**:
  - `npm run test` / `npx eslint` results
- **Manual Verification**:
  - Step-by-step verification performed locally (e.g. validated form inputs, verified dropdown interactions, tested responsive behavior).

## 📸 Screenshots / Screen Recordings (if applicable)

<!-- Screenshots or screen recordings for any UI changes -->

|           Before           |           After            |
| :------------------------: | :------------------------: |
| _(Image/recording or N/A)_ | _(Image/recording or N/A)_ |

## ✅ PR Checklist

<!-- Confirmation that the code has been reviewed, debug code has been removed, and the PR is ready for review -->

- [x] Code has been self-reviewed and adheres to project standards.
- [x] Debug code, `console.log` statements, and temporary comments have been removed.
- [x] Linting and type checks pass with zero errors (`npm run lint` / `npx eslint`).
- [x] Tested locally and confirmed expected behavior.
- [x] PR is ready for review.
```

### 4. Present and Refine

1. Present the generated title and markdown body in a clean code block.
2. Ask the user if they'd like to adjust any details (e.g., ticket ID, screenshots, specific wording).
