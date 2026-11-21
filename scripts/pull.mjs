#!/usr/bin/env node
import { c, filterRepos, loadConfig, parseArgs } from './lib/config.mjs';
import {
  checkoutBranch,
  fetchRepo,
  getCurrentBranch,
  getDirtyFiles,
  isGitRepo,
  pullRepo,
} from './lib/git.mjs';

function printHelp() {
  console.log(`
${c.bold('Usage:')} npm run pull -- [options]

Fetches and pulls the latest changes across cloned repositories.
By default uses fast-forward pulls and skips repos with uncommitted changes.

${c.bold('Options:')}
  --repo, -r <names>   Comma-separated or repeated repo name(s) to pull
  --branch, -b <name>  Checkout and pull a specific branch across selected repos
  --rebase             Pull with --rebase instead of --ff-only
  --autostash          Use with --rebase to auto-stash dirty working trees
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
  const useRebase = args.rebase || args.autostash;

  console.log(
    c.bold(
      `Pulling latest changes${args.branch ? ` (branch: ${args.branch})` : ''} across ${repos.length} repo(s)...\n`
    )
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const repo of repos) {
    if (!isGitRepo(repo.dir)) {
      console.log(`  ${c.yellow('!')} ${c.bold(repo.name)} — ${c.yellow('not cloned yet')}`);
      skipped += 1;
      continue;
    }

    const dirty = getDirtyFiles(repo.dir);
    if (dirty.length > 0 && !args.autostash) {
      console.log(
        `  ${c.yellow('!')} ${c.bold(repo.name)} — ${c.yellow(`skipped (${dirty.length} uncommitted change${dirty.length === 1 ? '' : 's'})`)}`
      );
      skipped += 1;
      continue;
    }

    const fetchRes = fetchRepo(repo.dir);
    if (!fetchRes.ok) {
      console.error(`  ${c.red('✗')} ${c.bold(repo.name)} — fetch failed: ${fetchRes.stderr}`);
      failed += 1;
      continue;
    }

    let currentBranch = getCurrentBranch(repo.dir);
    if (args.branch && currentBranch !== args.branch) {
      const coRes = checkoutBranch(repo.dir, args.branch);
      if (!coRes.ok) {
        console.error(`  ${c.red('✗')} ${c.bold(repo.name)} — checkout "${args.branch}" failed: ${coRes.stderr}`);
        failed += 1;
        continue;
      }
      currentBranch = args.branch;
    }

    const pullRes = pullRepo(repo.dir, { rebase: useRebase, autostash: args.autostash });
    if (pullRes.ok) {
      const summaryLine = pullRes.stdout.split('\n').pop() || 'up to date';
      console.log(
        `  ${c.green('✓')} ${c.bold(repo.name)} ${c.cyan(`[${currentBranch}]`)} — ${c.dim(summaryLine)}`
      );
      updated += 1;
    } else {
      console.error(
        `  ${c.red('✗')} ${c.bold(repo.name)} ${c.cyan(`[${currentBranch}]`)} — pull failed: ${pullRes.stderr}`
      );
      failed += 1;
    }
  }

  console.log(
    `\n${c.bold('Summary:')} ${c.green(`${updated} pulled`)}, ${skipped > 0 ? c.yellow(`${skipped} skipped`) : c.dim('0 skipped')}, ${failed > 0 ? c.red(`${failed} failed`) : c.dim('0 failed')}`
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error(`${c.red('Error:')} ${err.message}`);
  process.exitCode = 1;
}
