import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
export const CONFIG_PATH = path.join(WORKSPACE_ROOT, 'workspace.config.json');
export const LOCAL_PREFS_PATH = path.join(WORKSPACE_ROOT, '.workspace-local.json');

const VALID_STRATEGIES = new Set(['gitignore', 'git-exclude', 'both']);
const VALID_RULE_FORMATS = new Set(['claude', 'copilot', 'cursor']);

const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false;
const wrap = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  cyan: wrap('36'),
};

function normalizeSyncEntry(entry) {
  if (typeof entry === 'string') {
    return { source: entry, target: entry };
  }
  if (entry?.source && entry?.target) {
    return { source: entry.source, target: entry.target };
  }
  throw new Error(`Invalid sync path entry: ${JSON.stringify(entry)}`);
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing configuration file: ${CONFIG_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const reposDirName = raw.reposDir || 'repos';
  const reposDir = path.resolve(WORKSPACE_ROOT, reposDirName);
  const repoAgentsDirName = raw.repoAgentsDir || 'repo-agents';
  const repoAgentsDir = path.resolve(WORKSPACE_ROOT, repoAgentsDirName);
  const ignoreStrategy = raw.ignoreStrategy || 'gitignore';

  if (!VALID_STRATEGIES.has(ignoreStrategy)) {
    throw new Error(
      `Invalid ignoreStrategy "${ignoreStrategy}" in workspace.config.json. Expected one of: ${[...VALID_STRATEGIES].join(', ')}`
    );
  }

  if (!Array.isArray(raw.repos)) {
    throw new Error('workspace.config.json must contain a "repos" array.');
  }

  const repos = raw.repos.map((entry) => {
    if (!entry?.name || !entry?.url) {
      throw new Error(`Invalid repo entry in workspace.config.json: ${JSON.stringify(entry)}`);
    }
    return {
      name: entry.name,
      url: entry.url,
      defaultBranch: entry.defaultBranch || null,
      dir: path.join(reposDir, entry.name),
      overlayDir: path.join(repoAgentsDir, entry.name),
      excludePaths: Array.isArray(entry.excludePaths) ? entry.excludePaths : [],
    };
  });

  const agentSyncPaths = (raw.agentSyncPaths || []).map(normalizeSyncEntry);

  const agentFrameworks = {};
  if (raw.agentFrameworks && typeof raw.agentFrameworks === 'object') {
    for (const [id, def] of Object.entries(raw.agentFrameworks)) {
      if (!def || !Array.isArray(def.paths)) {
        throw new Error(`Invalid agentFrameworks entry "${id}" in workspace.config.json.`);
      }
      if (def.projectRulesFormat && !VALID_RULE_FORMATS.has(def.projectRulesFormat)) {
        throw new Error(
          `Invalid projectRulesFormat "${def.projectRulesFormat}" for framework "${id}". Expected one of: ${[...VALID_RULE_FORMATS].join(', ')}`
        );
      }
      agentFrameworks[id] = {
        id,
        label: def.label || id,
        description: def.description || '',
        paths: def.paths.map(normalizeSyncEntry),
        projectRulesTo: def.projectRulesTo || null,
        projectRulesFormat: def.projectRulesFormat || null,
        projectSkillsTo: def.projectSkillsTo || null,
      };
    }
  }

  return {
    workspaceRoot: WORKSPACE_ROOT,
    reposDirName,
    reposDir,
    repoAgentsDirName,
    repoAgentsDir,
    ignoreStrategy,
    agentSyncPaths,
    agentFrameworks,
    frameworkIds: Object.keys(agentFrameworks),
    repos,
  };
}

export function loadLocalPrefs() {
  if (!fs.existsSync(LOCAL_PREFS_PATH)) {
    return { frameworks: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(LOCAL_PREFS_PATH, 'utf8'));
    return {
      frameworks: Array.isArray(raw.frameworks) ? raw.frameworks : null,
    };
  } catch {
    return { frameworks: null };
  }
}

export function saveLocalPrefs({ frameworks }) {
  const payload = {
    frameworks,
  };
  fs.writeFileSync(LOCAL_PREFS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function resolveFrameworkIds(requested, availableIds) {
  if (!requested || requested.length === 0) {
    return [...availableIds];
  }

  const normalized = requested.map((s) => s.toLowerCase());
  if (normalized.includes('all')) {
    return [...availableIds];
  }

  const knownSet = new Set(availableIds);
  const unknown = normalized.filter((id) => !knownSet.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown agent framework(s): ${unknown.join(', ')}. Available: ${availableIds.join(', ')}, all`
    );
  }

  const wanted = new Set(normalized);
  return availableIds.filter((id) => wanted.has(id));
}

export function parseArgs(argv) {
  const options = {
    repos: [],
    agents: [],
    branch: null,
    strategy: null,
    dryRun: false,
    yes: false,
    ssh: false,
    autostash: false,
    rebase: false,
    help: false,
    positionals: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--ssh') {
      options.ssh = true;
    } else if (arg === '--autostash') {
      options.autostash = true;
    } else if (arg === '--rebase') {
      options.rebase = true;
    } else if (arg === '--repo' || arg === '-r') {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      options.repos.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg.startsWith('--repo=')) {
      const val = arg.slice('--repo='.length);
      options.repos.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--agents' || arg === '--agent' || arg === '--frameworks' || arg === '--framework' || arg === '-a') {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      options.agents.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (
      arg.startsWith('--agents=') ||
      arg.startsWith('--agent=') ||
      arg.startsWith('--frameworks=') ||
      arg.startsWith('--framework=')
    ) {
      const val = arg.slice(arg.indexOf('=') + 1);
      options.agents.push(...val.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg === '--branch' || arg === '-b') {
      const val = argv[++i];
      if (!val) throw new Error(`Missing value for ${arg}`);
      options.branch = val.trim();
    } else if (arg.startsWith('--branch=')) {
      options.branch = arg.slice('--branch='.length).trim();
    } else if (arg === '--strategy') {
      const val = argv[++i];
      if (!val || !VALID_STRATEGIES.has(val)) {
        throw new Error(`Invalid --strategy value "${val}". Expected: ${[...VALID_STRATEGIES].join(', ')}`);
      }
      options.strategy = val;
    } else if (arg.startsWith('--strategy=')) {
      const val = arg.slice('--strategy='.length);
      if (!VALID_STRATEGIES.has(val)) {
        throw new Error(`Invalid --strategy value "${val}". Expected: ${[...VALID_STRATEGIES].join(', ')}`);
      }
      options.strategy = val;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else {
      options.positionals.push(arg);
    }
  }

  return options;
}

export function filterRepos(repos, requestedNames) {
  if (!requestedNames || requestedNames.length === 0) {
    return repos;
  }

  const knownNames = new Set(repos.map((r) => r.name));
  const unknown = requestedNames.filter((n) => !knownNames.has(n));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown repo(s): ${unknown.join(', ')}. Available: ${repos.map((r) => r.name).join(', ')}`
    );
  }

  const wanted = new Set(requestedNames);
  return repos.filter((r) => wanted.has(r.name));
}

export function toSshUrl(url) {
  const match = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return url;
  const [, host, repoPath] = match;
  return `git@${host}:${repoPath}.git`;
}
