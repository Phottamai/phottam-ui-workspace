# Phottam UI Workspace

Multi-repository workspace manager and single source of truth for AI coding agent contexts across all Phottam UI repositories.

- **Zero external dependencies** — requires only Node.js `>= 20` and Git (no `npm install` needed).
- **Independent Git tracking** — every cloned repository lives under `repos/` (ignored by this workspace repo) and manages its own Git history without submodules.
- **Centralized AI agent context** — maintain Copilot (`.github/agents`, `.github/instructions`, `.github/copilot-instructions.md`), Claude Code (`.claude`, `CLAUDE.md`), and shared agent files (`.agents`, `AGENTS.md`) in one place and sync them out to every cloned repository.
- **Safe `.github/` handling** — only specific agent paths inside `.github/` are synced and ignored, so existing repository CI workflows (`.github/workflows/`), PR templates, and `CODEOWNERS` are never modified or ignored.

---

## Quick Start

```bash
git clone <this-workspace-repo-url> phottam-ui-workspace
cd phottam-ui-workspace
npm run setup
```

Then open `phottam-ui.code-workspace` in VS Code / Cursor / Antigravity to work across all repositories at once.

---

## Managed Repositories

Configured in [`workspace.config.json`](./workspace.config.json):

- `phottam-website` — `https://github.com/Phottamai/phottam-website.git`
- `phottam-web` — `https://github.com/Phottamai/phottam-web.git`
- `phottam-b2b-pwa` — `https://github.com/Phottamai/phottam-b2b-pwa.git`
- `phottam-b2c` — `https://github.com/Phottamai/phottam-b2c.git`
- `phottam-platform-kit` — `https://github.com/Phottamai/phottam-platform-kit.git`
- `phottam-desktop` — `https://github.com/Phottamai/phottam-desktop.git`

---

## Commands

| Command | Description |
| :--- | :--- |
| `npm run setup` | Clones all missing repos and syncs agent contexts into each repo. |
| `npm run clone` | Clones missing repos into `repos/` (skips repos already present). |
| `npm run sync` | Prompts for your AI agent framework(s) (multi-select), projects shared rules/skills into native formats, copies overlays, and updates ignore rules. |
| `npm run pull` | Fetches and fast-forward pulls latest changes across all clean cloned repos. |
| `npm run status` | Shows branch, dirty state, ahead/behind counts, and agent sync status for every repo. |
| `npm run checkout -- <branch>` | Switches all clean cloned repos to `<branch>`. |
| `npm run clean:agents` | Removes synced agent files and managed ignore blocks from cloned repos. |

### Useful Flags

All scripts accept `--repo` / `-r` (repeatable or comma-separated) and `--help`:

```bash
# Clone using SSH URLs instead of HTTPS
npm run clone -- --ssh

# Sync interactively (multi-select prompt for frameworks)
npm run sync

# Sync only specific framework(s) non-interactively
npm run sync -- --agents antigravity,claude
npm run sync -- --agents copilot --repo phottam-web

# Re-sync using your previously saved selection without prompting
npm run sync -- --yes

# Preview sync without modifying files
npm run sync -- --agents all --dry-run

# Pull latest changes from a specific branch across all repos
npm run pull -- --branch develop

# Pull with rebase + autostash on a single repo
npm run pull -- --repo phottam-web --rebase --autostash

# Switch branch across selected repos
npm run checkout -- main --repo phottam-web,phottam-desktop
```

---

## Managing AI Agents & Ignore Strategy

1. **Single source of truth for rules & skills (`.agents/`)** — Author shared rules in `.agents/rules/*.md` and skills in `.agents/skills/<name>/SKILL.md` once:
   - **Antigravity**: syncs `.agents/` and `AGENTS.md`.
   - **Claude Code**: syncs `CLAUDE.md`, `AGENTS.md`, `.claude/`, and automatically projects `.agents/rules/*.md` → `.claude/rules/*.md` and `.agents/skills/` → `.claude/skills/`.
   - **GitHub Copilot**: syncs `AGENTS.md`, `.github/copilot-instructions.md`, `.github/agents/`, `.github/instructions/`, and automatically projects `.agents/rules/*.md` → `.github/instructions/*.instructions.md` (with `applyTo` frontmatter) and `.agents/skills/` → `.github/skills/`.
   - **Cursor**: syncs `AGENTS.md`, `.agents/skills/`, and automatically projects `.agents/rules/*.md` → `.cursor/rules/*.mdc` (with `alwaysApply` frontmatter).
2. **Per-developer framework selection** — Running `npm run sync` prompts you to choose one or more frameworks (`antigravity`, `claude`, `copilot`, `cursor`). Only files for the selected frameworks are synced, any previously synced files from deselected frameworks are cleaned up automatically, and your choice is saved locally in `.workspace-local.json` (git-ignored) so `npm run status` and subsequent syncs remember it.
3. **Repo-specific agents (single repo)** — Place files under `repo-agents/<repo-name>/` mirroring the repo's relative path (for example `repo-agents/phottam-desktop/CLAUDE.md`, `repo-agents/phottam-web/.agents/skills/mock-generator/SKILL.md`, or `repo-agents/phottam-desktop/.github/agents/electron.agent.md`):
   - Files in folders like `.github/agents/`, `.claude/`, or `.agents/skills/` are merged alongside shared agents (and repo-specific `.agents/rules/` & `.agents/skills/` are also projected to whichever frameworks you selected).
   - Any file matching a shared path (such as `CLAUDE.md`, `AGENTS.md`, or `.github/copilot-instructions.md`) **replaces** the shared copy for that repo only.
   - To exclude a specific shared file or folder from one repo, add `"excludePaths": [".agents/rules/nextjs-16.md"]` to that repo entry in `workspace.config.json` — excluded rules and skills are omitted from all projected framework targets too.
4. Run `npm run sync` to distribute shared and repo-specific agent files into every cloned repository.

### Ignore Strategy (`ignoreStrategy` in `workspace.config.json`)

Each cloned repo automatically gets a managed ignore block (`# >>> phottam-workspace-agents` … `# <<< phottam-workspace-agents`) excluding synced agent paths from commits:

- `"gitignore"` *(default)* — updates `<repo>/.gitignore`. Note that `.gitignore` will show as modified in `git status` until that block is committed in the repo.
- `"git-exclude"` — writes the exact same block to `<repo>/.git/info/exclude`, keeping `git status` completely clean in every cloned repo without touching tracked `.gitignore`.
- `"both"` — writes to both files.

You can switch the default in `workspace.config.json` or override per run with `--strategy`:

```bash
npm run sync -- --strategy git-exclude
```

---

## Adding New Repositories or Agent Paths

Edit [`workspace.config.json`](./workspace.config.json):
- Add another `{ "name": "...", "url": "..." }` item to `repos` (and optionally to `phottam-ui.code-workspace`), then run `npm run setup`.
- Add another path (e.g., `".cursor/rules"`) to `agentSyncPaths`, then run `npm run sync`.
