#!/usr/bin/env node
import { c, filterRepos, loadConfig, parseArgs } from './lib/config.mjs';
import {
  checkoutBranch,
  fetchRepo,
  getCurrentBranch,
  getDirtyFiles,
  isGitRepo,
} from './lib/git.mjs';

function printHelp() {
  console.log(`
${c.bold('Usage:')} npm run checkout -- <branch> [options]

Fetches and switches to <branch> across all or selected cloned repositories.
Skips repos with uncommitted changes.

${c.bold('Options:')}
  --repo, -r <names>   Comma-separated or repeated repo name(s)
  --branch, -b <name>  Alternative way to specify branch name
  --help, -h           Show this help message
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const branch = args.branch || args.positionals[0];
  if (!branch) {
    console.error(`${c.red('Error:')} Please provide a branch name, e.g. "npm run checkout -- develop"`);
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  const repos = filterRepos(config.repos, args.repos);

  console.log(c.bold(`Switching ${repos.length} repo(s) to branch "${branch}"...\n`));

  let switched = 0;
  let skipped = 0;
  let failed = 0;

  for (const repo of repos) {
    if (!isGitRepo(repo.dir)) {
      console.log(`  ${c.yellow('!')} ${c.bold(repo.name)} — ${c.yellow('not cloned yet')}`);
      skipped += 1;
      continue;
    }

    const current = getCurrentBranch(repo.dir);
    if (current === branch) {
      console.log(`  ${c.dim('•')} ${c.bold(repo.name)} — ${c.dim(`already on ${branch}`)}`);
      skipped += 1;
      continue;
    }

    const dirty = getDirtyFiles(repo.dir);
    if (dirty.length > 0) {
      console.log(`  ${c.yellow('!')} ${c.bold(repo.name)} — ${c.yellow(`skipped (${dirty.length} uncommitted changes)`)}`);
      skipped += 1;
      continue;
    }

    fetchRepo(repo.dir);
    const res = checkoutBranch(repo.dir, branch);
    if (res.ok) {
      console.log(`  ${c.green('✓')} ${c.bold(repo.name)} — switched ${c.dim(current)} → ${c.cyan(branch)}`);
      switched += 1;
    } else {
      console.error(`  ${c.red('✗')} ${c.bold(repo.name)} — ${res.stderr}`);
      failed += 1;
    }
  }

  console.log(
    `\n${c.bold('Summary:')} ${c.green(`${switched} switched`)}, ${c.dim(`${skipped} skipped`)}, ${failed > 0 ? c.red(`${failed} failed`) : c.dim('0 failed')}`
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
