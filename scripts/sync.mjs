#!/usr/bin/env node
import {
  c,
  filterRepos,
  loadConfig,
  loadLocalPrefs,
  parseArgs,
  resolveFrameworkIds,
  saveLocalPrefs,
} from './lib/config.mjs';
import { isGitRepo } from './lib/git.mjs';
import { promptMultiSelect } from './lib/prompt.mjs';
import { buildRepoSyncPlan, syncRepoWithPlan } from './lib/sync-utils.mjs';

function printHelp(availableFrameworks = []) {
  const fwList = availableFrameworks.length > 0 ? availableFrameworks.join(' | ') : 'antigravity | claude | copilot | cursor';
  console.log(`
${c.bold('Usage:')} npm run sync -- [options]

Prompts for which AI agent framework(s) you use (multi-select), projects canonical
.agents/rules/ and .agents/skills/ into the selected frameworks' native formats,
applies repo-specific overlays from repo-agents/<repo-name>/, cleans up unselected
framework files, and updates managed ignore rules.

${c.bold('Options:')}
  --agents, -a <list>            Comma-separated framework(s): ${fwList} | all
  --yes, -y                      Skip interactive prompt (uses saved selection or all)
  --repo, -r <names>             Comma-separated or repeated repo name(s) to sync
  --strategy <mode>              Override ignoreStrategy: gitignore | git-exclude | both
  --dry-run                      Preview sync and ignore updates without modifying files
  --help, -h                     Show this help message
`);
}

async function selectFrameworks(config, args) {
  const availableIds = config.frameworkIds;
  if (availableIds.length === 0) {
    return null;
  }

  if (args.agents.length > 0) {
    return resolveFrameworkIds(args.agents, availableIds);
  }

  const saved = loadLocalPrefs().frameworks;
  const validSaved = Array.isArray(saved)
    ? saved.filter((id) => availableIds.includes(id))
    : [];

  if (args.yes || !process.stdin.isTTY || !process.stdout.isTTY) {
    return validSaved.length > 0 ? validSaved : [...availableIds];
  }

  const choices = availableIds.map((id) => {
    const fw = config.agentFrameworks[id];
    return {
      value: id,
      label: fw.label,
      description: fw.description,
    };
  });

  return promptMultiSelect({
    title: 'Select AI agent framework(s) to sync:',
    choices,
    initialSelected: validSaved.length > 0 ? validSaved : availableIds,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  if (args.help) {
    printHelp(config.frameworkIds);
    return;
  }

  const repos = filterRepos(config.repos, args.repos);
  const strategy = args.strategy || config.ignoreStrategy;
  const selectedFrameworks = await selectFrameworks(config, args);

  if (!args.dryRun && selectedFrameworks && selectedFrameworks.length > 0) {
    saveLocalPrefs({ frameworks: selectedFrameworks });
  }

  const fwSummary = selectedFrameworks
    ? selectedFrameworks.map((id) => config.agentFrameworks[id]?.label || id).join(', ')
    : 'all';

  console.log(
    c.bold(
      `Syncing [${fwSummary}] + ${config.repoAgentsDirName}/ overlays [ignoreStrategy=${strategy}]${args.dryRun ? ' (dry-run)' : ''}...\n`
    )
  );

  let syncedRepos = 0;
  let skippedRepos = 0;

  for (const repo of repos) {
    if (!isGitRepo(repo.dir)) {
      console.log(`  ${c.yellow('!')} ${c.bold(repo.name)} — ${c.yellow('not cloned yet (run npm run clone)')}`);
      skippedRepos += 1;
      continue;
    }

    const plan = buildRepoSyncPlan(config.workspaceRoot, repo, config, selectedFrameworks);
    const result = syncRepoWithPlan(repo.dir, plan, strategy, { dryRun: args.dryRun });
    const ignoreSummary = result.ignoreResults.map((r) => `${r.filePath}:${r.status}`).join(', ');

    const details = [`${result.writtenCount} files`];
    if (plan.projectedRuleCount > 0) {
      details.push(`${plan.projectedRuleCount} projected rule(s)`);
    }
    if (plan.overlayApplied.length > 0) {
      details.push(c.cyan(`+${plan.overlayApplied.length} repo-specific`));
    }
    if (result.staleRemoved.length > 0) {
      details.push(`${result.staleRemoved.length} stale cleaned`);
    }

    console.log(
      `  ${c.green('✓')} ${c.bold(repo.name)} — ${details.join(', ')} ${c.dim(`(${ignoreSummary})`)}`
    );
    if (plan.missingSources.length > 0) {
      console.log(`    ${c.dim(`skipped missing source(s): ${plan.missingSources.join(', ')}`)}`);
    }
    syncedRepos += 1;
  }

  console.log(
    `\n${c.bold('Summary:')} ${c.green(`${syncedRepos} synced`)}, ${skippedRepos > 0 ? c.yellow(`${skippedRepos} not cloned`) : c.dim('0 skipped')}`
  );
  if (!args.dryRun && selectedFrameworks) {
    console.log(c.dim(`Saved selection (${selectedFrameworks.join(', ')}) to .workspace-local.json`));
  }
}

main().catch((err) => {
  console.error(`${c.red('Error:')} ${err.message}`);
  process.exitCode = 1;
});
