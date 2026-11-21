#!/usr/bin/env node
import { c, filterRepos, loadConfig, parseArgs } from './lib/config.mjs';
import { isGitRepo } from './lib/git.mjs';
import {
  getAllManagedPaths,
  removeAgentEntry,
  removeManagedIgnoreBlocks,
  removeOverlayEntries,
} from './lib/sync-utils.mjs';

function printHelp() {
  console.log(`
${c.bold('Usage:')} npm run clean:agents -- [options]

Removes all synced agent files/directories and managed ignore blocks from cloned repositories.
Never removes repo-owned files such as .github/workflows.

${c.bold('Options:')}
  --repo, -r <names>   Comma-separated or repeated repo name(s) to clean
  --dry-run            Preview removals without modifying files
  --help, -h           Show this help message
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = loadConfig();
  const repos = filterRepos(config.repos, args.repos);
  const managedPaths = getAllManagedPaths(config);

  console.log(
    c.bold(`Cleaning synced agents from ${repos.length} repo(s)${args.dryRun ? ' (dry-run)' : ''}...\n`)
  );

  let cleaned = 0;
  let skipped = 0;

  for (const repo of repos) {
    if (!isGitRepo(repo.dir)) {
      console.log(`  ${c.dim('•')} ${c.bold(repo.name)} — ${c.dim('not cloned, skipping')}`);
      skipped += 1;
      continue;
    }

    let removedCount = 0;
    for (const entry of managedPaths) {
      const res = removeAgentEntry(repo.dir, entry, { dryRun: args.dryRun });
      if (res.status === 'removed') removedCount += 1;
    }

    const removedOverlays = removeOverlayEntries(repo.dir, repo.overlayDir, {
      dryRun: args.dryRun,
    });
    removedCount += removedOverlays.length;

    const removedIgnores = removeManagedIgnoreBlocks(repo.dir, { dryRun: args.dryRun });
    const ignoreNote =
      removedIgnores.length > 0
        ? ` + cleaned ${removedIgnores.map((r) => r.filePath).join(', ')}`
        : '';

    console.log(
      `  ${c.green('✓')} ${c.bold(repo.name)} — removed ${removedCount} agent path(s)${c.dim(ignoreNote)}`
    );
    cleaned += 1;
  }

  console.log(`\n${c.bold('Summary:')} ${c.green(`${cleaned} cleaned`)}, ${c.dim(`${skipped} skipped`)}`);
}

try {
  main();
} catch (err) {
  console.error(`${c.red('Error:')} ${err.message}`);
  process.exitCode = 1;
}
