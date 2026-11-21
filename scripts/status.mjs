#!/usr/bin/env node
import {
  c,
  filterRepos,
  loadConfig,
  loadLocalPrefs,
  parseArgs,
  resolveFrameworkIds,
} from './lib/config.mjs';
import {
  getAheadBehind,
  getCurrentBranch,
  getDirtyFiles,
  isGitRepo,
} from './lib/git.mjs';
import { checkRepoSyncStatus } from './lib/sync-utils.mjs';

function printHelp(availableFrameworks = []) {
  const fwList = availableFrameworks.length > 0 ? availableFrameworks.join(' | ') : 'antigravity | claude | copilot | cursor';
  console.log(`
${c.bold('Usage:')} npm run status -- [options]

Displays branch, working tree state, remote tracking delta, and agent sync status
for all repositories configured in workspace.config.json.

${c.bold('Options:')}
  --agents, -a <list>  Check sync status for specific framework(s): ${fwList} | all
  --repo, -r <names>   Comma-separated or repeated repo name(s) to inspect
  --strategy <mode>    Override ignoreStrategy when checking sync status
  --help, -h           Show this help message
`);
}

function pad(str, width) {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function resolveStatusFrameworks(config, args) {
  if (config.frameworkIds.length === 0) {
    return { ids: null, source: 'config' };
  }
  if (args.agents.length > 0) {
    return { ids: resolveFrameworkIds(args.agents, config.frameworkIds), source: 'flag' };
  }
  const saved = loadLocalPrefs().frameworks;
  const validSaved = Array.isArray(saved)
    ? saved.filter((id) => config.frameworkIds.includes(id))
    : [];
  if (validSaved.length > 0) {
    return { ids: validSaved, source: '.workspace-local.json' };
  }
  return { ids: [...config.frameworkIds], source: 'default (all)' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  if (args.help) {
    printHelp(config.frameworkIds);
    return;
  }

  const repos = filterRepos(config.repos, args.repos);
  const strategy = args.strategy || config.ignoreStrategy;
  const { ids: selectedFrameworks, source: fwSource } = resolveStatusFrameworks(config, args);
  const nameWidth = Math.max(12, ...repos.map((r) => r.name.length)) + 2;

  if (selectedFrameworks) {
    console.log(
      c.dim(`Frameworks: ${selectedFrameworks.join(', ')} (${fwSource})\n`)
    );
  }

  console.log(
    `${c.bold(pad('REPO', nameWidth))}${c.bold(pad('BRANCH', 18))}${c.bold(pad('GIT STATE', 22))}${c.bold('AGENTS')}`
  );
  console.log(c.dim('-'.repeat(nameWidth + 56)));

  for (const repo of repos) {
    if (!isGitRepo(repo.dir)) {
      console.log(
        `${c.bold(pad(repo.name, nameWidth))}${c.yellow(pad('not cloned', 18))}${c.dim(pad('-', 22))}${c.dim('-')}`
      );
      continue;
    }

    const branch = getCurrentBranch(repo.dir);
    const dirty = getDirtyFiles(repo.dir);
    const { ahead, behind } = getAheadBehind(repo.dir);

    const gitParts = [];
    gitParts.push(dirty.length === 0 ? 'clean' : `${dirty.length} dirty`);
    if (ahead > 0) gitParts.push(`+${ahead}`);
    if (behind > 0) gitParts.push(`-${behind}`);
    const gitRaw = gitParts.join(' ');
    const gitColored = dirty.length === 0 ? c.green(pad(gitRaw, 22)) : c.yellow(pad(gitRaw, 22));

    const syncStatus = checkRepoSyncStatus(
      config.workspaceRoot,
      repo,
      config,
      selectedFrameworks,
      strategy
    );
    let agentLabel;
    if (syncStatus.inSync) {
      const overlayTag = syncStatus.overlayCount > 0 ? ` ${c.dim(`(+${syncStatus.overlayCount} repo-specific)`)}` : '';
      agentLabel = `${c.green('in sync')}${overlayTag}`;
    } else {
      const reasons = [];
      if (syncStatus.missing.length > 0) reasons.push(`${syncStatus.missing.length} missing`);
      if (syncStatus.drifted.length > 0) reasons.push(`${syncStatus.drifted.length} drifted`);
      if (syncStatus.extra.length > 0) reasons.push(`${syncStatus.extra.length} extra`);
      if (syncStatus.ignoreOutOfSync.length > 0) reasons.push('ignore out of sync');
      agentLabel = c.yellow(`out of sync (${reasons.join(', ')})`);
    }

    console.log(
      `${c.bold(pad(repo.name, nameWidth))}${c.cyan(pad(branch, 18))}${gitColored}${agentLabel}`
    );
  }
}

try {
  main();
} catch (err) {
  console.error(`${c.red('Error:')} ${err.message}`);
  process.exitCode = 1;
}
