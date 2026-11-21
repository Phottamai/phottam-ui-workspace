import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function runGit(args, { cwd, stdio = 'pipe' } = {}) {
  try {
    const stdout = execFileSync('git', args, {
      cwd,
      stdio,
      encoding: 'utf8',
    });
    return {
      ok: true,
      stdout: typeof stdout === 'string' ? stdout.trim() : '',
      stderr: '',
    };
  } catch (err) {
    return {
      ok: false,
      status: err.status ?? 1,
      stdout: typeof err.stdout === 'string' ? err.stdout.trim() : '',
      stderr: typeof err.stderr === 'string' ? err.stderr.trim() : err.message,
    };
  }
}

export function isGitRepo(dir) {
  if (!fs.existsSync(dir)) return false;
  if (fs.existsSync(path.join(dir, '.git'))) return true;
  const res = runGit(['rev-parse', '--is-inside-work-tree'], { cwd: dir });
  return res.ok && res.stdout === 'true';
}

export function cloneRepo(url, targetDir, { branch } = {}) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  const args = ['clone'];
  if (branch) {
    args.push('--branch', branch);
  }
  args.push(url, targetDir);
  return runGit(args, { stdio: 'inherit' });
}

function parseGitProgressPercent(line) {
  const match = line.match(
    /(Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files):\s+(\d+)%/i
  );
  if (match) {
    const phase = match[1].toLowerCase();
    const p = Math.min(100, Math.max(0, Number.parseInt(match[2], 10)));
    if (phase === 'counting objects') return Math.round(2 + (p / 100) * 8);
    if (phase === 'compressing objects') return Math.round(10 + (p / 100) * 10);
    if (phase === 'receiving objects') return Math.round(20 + (p / 100) * 55);
    if (phase === 'resolving deltas') return Math.round(75 + (p / 100) * 17);
    if (phase === 'updating files') return Math.round(92 + (p / 100) * 7);
  }
  if (/Enumerating objects:/i.test(line)) return 2;
  return null;
}

export function cloneRepoWithProgress(url, targetDir, { branch, onProgress } = {}) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  const args = ['clone', '--progress'];
  if (branch) {
    args.push('--branch', branch);
  }
  args.push(url, targetDir);

  return new Promise((resolve) => {
    const child = spawn('git', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderrAll = '';
    let buffer = '';
    let currentPercent = 0;

    const handleChunk = (chunk) => {
      const text = chunk.toString('utf8');
      stderrAll += text;
      buffer += text;

      const parts = buffer.split(/[\r\n]+/);
      buffer = parts.pop() || '';

      for (const line of parts) {
        const pct = parseGitProgressPercent(line);
        if (pct !== null && pct > currentPercent) {
          currentPercent = pct;
          onProgress?.(currentPercent);
        }
      }
    };

    child.stderr.on('data', handleChunk);

    child.on('error', (err) => {
      resolve({ ok: false, stderr: err.message });
    });

    child.on('close', (code) => {
      if (buffer) {
        const pct = parseGitProgressPercent(buffer);
        if (pct !== null && pct > currentPercent) {
          currentPercent = pct;
          onProgress?.(currentPercent);
        }
      }

      if (code === 0) {
        onProgress?.(100);
        resolve({ ok: true, stderr: '' });
      } else {
        const errorLines = stderrAll
          .split(/[\r\n]+/)
          .map((l) => l.trim())
          .filter(
            (l) =>
              l &&
              !/^(Cloning into|remote:|Receiving objects|Resolving deltas|Updating files|Counting objects|Compressing objects|Enumerating objects)/i.test(
                l
              )
          );
        resolve({
          ok: false,
          stderr: errorLines.join(' | ') || stderrAll.trim() || `git exited with code ${code}`,
        });
      }
    });
  });
}

export function getCurrentBranch(dir) {
  const res = runGit(['symbolic-ref', '--short', 'HEAD'], { cwd: dir });
  if (res.ok && res.stdout) return res.stdout;
  const sha = runGit(['rev-parse', '--short', 'HEAD'], { cwd: dir });
  return sha.ok ? `detached@${sha.stdout}` : 'unknown';
}

export function getDirtyFiles(dir) {
  const res = runGit(['status', '--porcelain'], { cwd: dir });
  if (!res.ok || !res.stdout) return [];
  return res.stdout.split('\n').filter(Boolean);
}

export function getAheadBehind(dir) {
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: dir });
  if (!upstream.ok || !upstream.stdout) {
    return { upstream: null, ahead: 0, behind: 0 };
  }
  const counts = runGit(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { cwd: dir });
  if (!counts.ok || !counts.stdout) {
    return { upstream: upstream.stdout, ahead: 0, behind: 0 };
  }
  const [aheadStr, behindStr] = counts.stdout.split(/\s+/);
  return {
    upstream: upstream.stdout,
    ahead: Number.parseInt(aheadStr, 10) || 0,
    behind: Number.parseInt(behindStr, 10) || 0,
  };
}

export function fetchRepo(dir) {
  return runGit(['fetch', '--all', '--prune'], { cwd: dir });
}

export function localBranchExists(dir, branch) {
  return runGit(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: dir }).ok;
}

export function remoteBranchExists(dir, branch, remote = 'origin') {
  return runGit(['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${branch}`], { cwd: dir }).ok;
}

export function checkoutBranch(dir, branch) {
  if (localBranchExists(dir, branch)) {
    return runGit(['checkout', branch], { cwd: dir });
  }
  if (remoteBranchExists(dir, branch, 'origin')) {
    return runGit(['checkout', '-b', branch, '--track', `origin/${branch}`], { cwd: dir });
  }
  return {
    ok: false,
    stderr: `Branch "${branch}" not found locally or on origin.`,
  };
}

export function pullRepo(dir, { rebase = false, autostash = false } = {}) {
  const args = ['pull'];
  if (rebase) {
    args.push('--rebase');
    if (autostash) args.push('--autostash');
  } else {
    args.push('--ff-only');
  }
  return runGit(args, { cwd: dir });
}

export function isPathIgnored(dir, relPath) {
  const res = runGit(['check-ignore', '--quiet', relPath], { cwd: dir });
  return res.ok;
}
