#!/usr/bin/env node
import fs from 'node:fs';
import { c, filterRepos, loadConfig, parseArgs, toSshUrl } from './lib/config.mjs';
import { cloneRepoWithProgress, isGitRepo } from './lib/git.mjs';
import { createCloneProgress } from './lib/progress.mjs';

function printHelp() {
  console.log(`
${c.bold('Usage:')} npm run clone -- [options]

Clones repositories defined in workspace.config.json into the configured repos directory.
Already-cloned repositories are skipped safely.

${c.bold('Options:')}
  --repo, -r <names>   Comma-separated or repeated repo name(s) to clone
  --branch, -b <name>  Override branch to clone
  --ssh                Rewrite HTTPS GitHub URLs to SSH (git@github.com:...)
  --dry-run            Show what would be cloned without executing git clone
  --help, -h           Show this help message
`);
}

function padRight(str, width) {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = loadConfig();
  const repos = filterRepos(config.repos, args.repos);
  const nameWidth = Math.max(12, ...repos.map((r) => r.name.length)) + 2;

  if (!args.dryRun) {
    fs.mkdirSync(config.reposDir, { recursive: true });
  }

  let cloned = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    c.bold(`Cloning into ${config.reposDirName}/ (${repos.length} repo${repos.length === 1 ? '' : 's'})\n`)
  );

  for (const repo of repos) {
    const url = args.ssh ? toSshUrl(repo.url) : repo.url;
    const branch = args.branch || repo.defaultBranch || undefined;

    if (isGitRepo(repo.dir)) {
      console.log(`  ${c.dim('•')} ${c.bold(padRight(repo.name, nameWidth))} ${c.dim('already cloned')}`);
      skipped += 1;
      continue;
    }

    if (fs.existsSync(repo.dir)) {
      console.log(
        `  ${c.red('✗')} ${c.bold(padRight(repo.name, nameWidth))} ${c.red('directory exists (not a git repo)')}`
      );
      failed += 1;
      continue;
    }

    if (args.dryRun) {
      const branchSuffix = branch ? ` (${branch})` : '';
      console.log(`  ${c.cyan('~')} ${c.bold(padRight(repo.name, nameWidth))} ${c.dim(`0% → 100%${branchSuffix}`)}`);
      cloned += 1;
      continue;
    }

    const progress = createCloneProgress(repo.name, nameWidth);
    const res = await cloneRepoWithProgress(url, repo.dir, {
      branch,
      onProgress: (pct) => progress.update(pct),
    });

    if (res.ok) {
      progress.succeed();
      cloned += 1;
    } else {
      progress.fail(res.stderr);
      failed += 1;
    }
  }

  console.log(
    `\n${c.bold('Summary:')} ${c.green(`${cloned} cloned`)}, ${c.dim(`${skipped} skipped`)}, ${failed > 0 ? c.red(`${failed} failed`) : c.dim('0 failed')}`
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`${c.red('Error:')} ${err.message}`);
  process.exitCode = 1;
});
