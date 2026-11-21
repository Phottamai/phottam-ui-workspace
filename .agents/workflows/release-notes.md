---
description: Generate a production-grade Release Notes document comparing current branch with main
---

# Release Notes Generator

This workflow generates a production-grade Release Notes document in Markdown format, located within the `/release-notes` directory following the `YYYY-MM-DD.md` naming convention.

## Guardrails

- Perform a comprehensive delta analysis between `main` (or target branch) and the current branch.
- Maintain a professional, concise, and structured tone suitable for cross-functional stakeholders.
- Never make code modifications during this workflow; only create/update the release notes markdown file in `release-notes/`.
- Never execute git commit or push commands (user commits and pushes changes).

## Steps

### 1. Identify Date and Target File

- Determine today's date in `YYYY-MM-DD` format (e.g., `2026-08-30`).
- Target file path: `/release-notes/YYYY-MM-DD.md`.

### 2. Perform Delta Analysis

Gather changes between `main` and the current branch:

1. **Commit History**:
   ```bash
   git log main..HEAD --oneline
   ```
2. **Changed Files Summary**:
   ```bash
   git diff main --stat
   ```
3. **Inspect Detailed Diffs**:
   Review code changes to understand functional impact, refactors, and styling adjustments.

### 3. Synthesize & Categorize Changes

Synthesize all findings into the following standard sections:

1. **🚀 Business Logic Enhancements**:
   - Functional changes, feature additions, user flow updates, and business rule enhancements.
2. **🧱 Core & Common Components**:
   - Updates to shared libraries, reusable UI modules, or layout elements (especially components in the root `src/components/` and `src/layouts/` directories).
   - **Mandatory**: Include a dedicated bulleted list of all modified common component file paths and a concise summary of changes made to each component.
3. **🎨 UI/UX & Style Refinements**:
   - Visual and design system adjustments, animations, light/dark mode adaptations, responsive layouts, hover/focus states, and icon refinements.
4. **⚙️ Architectural & Infrastructure Updates**:
   - Changes to system architecture, design patterns, hooks, utilities, type definitions, configurations, build tools, or dependencies.

### 4. Create the Release Notes Document

Format the file at `/release-notes/YYYY-MM-DD.md` as follows:

```markdown
# Release Notes - YYYY-MM-DD

## 🚀 Business Logic Enhancements

- **Feature / Flow Title**:
  - Detailed bullet point describing functional changes and enhancements.

## 🧱 Core & Common Components

The following shared modules and reusable components located in the root `components/` and `layouts/` directories were added or updated:

- `ComponentName` (`src/components/...`)
- `LayoutName` (`src/layouts/...`)

### Component Changes Summary:

- **`ComponentName`**: Summary of specific prop, behavior, or styling changes.

## 🎨 UI/UX & Style Refinements

- **Area / Screen Title**:
  - Specific visual improvements, styling adjustments, or theme fixes.

## ⚙️ Architectural & Infrastructure Updates

- **Technical Area Title**:
  - Codebase structure, hooks, types, testing, or pattern updates.
```

### 5. Present to User

- Inform the user that the release notes have been generated.
- Provide a clickable markdown link to the newly created file: `[YYYY-MM-DD.md](file:///path/to/release-notes/YYYY-MM-DD.md)`.
- Highlight key highlights or ask if any refinements are desired.
