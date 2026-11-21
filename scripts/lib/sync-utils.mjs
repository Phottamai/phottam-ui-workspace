import fs from 'node:fs';
import path from 'node:path';

export const BLOCK_START = '# >>> phottam-workspace-agents (managed — do not edit)';
export const BLOCK_END = '# <<< phottam-workspace-agents';

const CANONICAL_RULES_DIR = '.agents/rules';
const CANONICAL_SKILLS_DIR = '.agents/skills';

function normalizeRelPath(p) {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function ensureInside(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === resolvedBase || !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Refusing to operate outside repo root: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function pruneEmptyParents(startDir, stopDir) {
  const resolvedStop = path.resolve(stopDir);
  let current = path.resolve(startDir);
  while (current !== resolvedStop && current.startsWith(resolvedStop + path.sep)) {
    if (!fs.existsSync(current)) break;
    if (fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function isExcluded(relPath, excludePaths = []) {
  const norm = normalizeRelPath(relPath);
  return excludePaths.some((raw) => {
    const ex = normalizeRelPath(raw);
    return norm === ex || norm.startsWith(`${ex}/`);
  });
}

function isPathWithin(relPath, prefix) {
  const norm = normalizeRelPath(relPath);
  const normPrefix = normalizeRelPath(prefix);
  return norm === normPrefix || norm.startsWith(`${normPrefix}/`);
}

function collectFilesRecursive(dirPath, base = '') {
  if (!fs.existsSync(dirPath)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursive(full, rel));
    } else if (entry.isFile()) {
      files.push({ rel, full });
    }
  }
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

function isCoveredByBaseIgnore(relPath, baseIgnoreEntries) {
  const anchored = `/${normalizeRelPath(relPath)}`;
  return baseIgnoreEntries.some((pattern) => {
    if (pattern.endsWith('/')) {
      return anchored.startsWith(pattern);
    }
    return anchored === pattern;
  });
}

function stripQuotes(val) {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function yamlQuote(val) {
  return JSON.stringify(String(val));
}

export function parseFrontmatter(rawText) {
  const match = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { meta: {}, body: rawText.replace(/^\r?\n+/, '') };
  }

  const meta = {};
  const lines = match[1].split(/\r?\n/);
  let currentListKey = null;

  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListKey) {
      if (!Array.isArray(meta[currentListKey])) meta[currentListKey] = [];
      meta[currentListKey].push(stripQuotes(listMatch[1]));
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '') {
        currentListKey = key;
        meta[key] = [];
      } else {
        currentListKey = null;
        meta[key] = stripQuotes(val);
      }
    }
  }

  const body = rawText.slice(match[0].length).replace(/^\r?\n+/, '');
  return { meta, body };
}

export function projectRuleContent(rawText, format) {
  const { meta, body } = parseFrontmatter(rawText);
  const cleanBody = body.endsWith('\n') ? body : `${body}\n`;

  if (format === 'claude') {
    const scopedPaths = Array.isArray(meta.paths)
      ? meta.paths
      : meta.paths
        ? [meta.paths]
        : meta.applyTo && meta.applyTo !== '**'
          ? [meta.applyTo]
          : meta.globs && meta.globs !== '**'
            ? [meta.globs]
            : [];

    if (scopedPaths.length > 0) {
      const frontmatter = [
        '---',
        'paths:',
        ...scopedPaths.map((p) => `  - ${yamlQuote(p)}`),
        '---',
      ].join('\n');
      return `${frontmatter}\n\n${cleanBody}`;
    }

    return cleanBody;
  }

  if (format === 'copilot') {
    const applyTo = meta.applyTo || meta.globs || (Array.isArray(meta.paths) && meta.paths.length > 0 ? meta.paths.join(',') : '**');
    const fmLines = ['---'];
    if (meta.description) {
      fmLines.push(`description: ${yamlQuote(meta.description)}`);
    }
    fmLines.push(`applyTo: ${yamlQuote(applyTo)}`);
    fmLines.push('---');
    return `${fmLines.join('\n')}\n\n${cleanBody}`;
  }

  if (format === 'cursor') {
    const globs = meta.globs || meta.applyTo || (Array.isArray(meta.paths) && meta.paths.length > 0 ? meta.paths.join(', ') : '');
    const alwaysApply = meta.trigger === 'always_on' || (!meta.description && !globs);
    const fmLines = ['---'];
    if (meta.description) {
      fmLines.push(`description: ${yamlQuote(meta.description)}`);
    }
    if (globs && globs !== '**') {
      fmLines.push(`globs: ${yamlQuote(globs)}`);
    }
    fmLines.push(`alwaysApply: ${alwaysApply ? 'true' : 'false'}`);
    fmLines.push('---');
    return `${fmLines.join('\n')}\n\n${cleanBody}`;
  }

  return rawText;
}

export function projectedRuleTargetRel(sourceRel, targetDir, format) {
  const normDir = normalizeRelPath(targetDir);
  const normRel = normalizeRelPath(sourceRel);
  const parsed = path.posix.parse(normRel);
  const basePath = parsed.dir ? `${normDir}/${parsed.dir}/${parsed.name}` : `${normDir}/${parsed.name}`;

  if (format === 'copilot') return `${basePath}.instructions.md`;
  if (format === 'cursor') return `${basePath}.mdc`;
  return `${basePath}.md`;
}

function deduplicateSyncEntries(workspaceRoot, rawEntries) {
  const byTarget = new Map();
  for (const entry of rawEntries) {
    const normTarget = normalizeRelPath(entry.target);
    if (!byTarget.has(normTarget)) {
      byTarget.set(normTarget, { source: normalizeRelPath(entry.source), target: normTarget });
    }
  }

  const entries = [...byTarget.values()];
  // Drop entries that are nested inside another selected directory entry (e.g. .agents/skills under .agents)
  return entries.filter((entry) => {
    return !entries.some((other) => {
      if (other.target === entry.target) return false;
      const otherSource = path.join(workspaceRoot, other.source);
      const otherIsDir = fs.existsSync(otherSource) && fs.statSync(otherSource).isDirectory();
      return otherIsDir && entry.target.startsWith(`${other.target}/`);
    });
  });
}

function collectFrameworkDefinitions(config, selectedFrameworkIds) {
  const hasFrameworkMap = config.agentFrameworks && Object.keys(config.agentFrameworks).length > 0;
  if (!hasFrameworkMap) {
    return null;
  }

  const ids =
    selectedFrameworkIds && selectedFrameworkIds.length > 0
      ? selectedFrameworkIds
      : Object.keys(config.agentFrameworks);

  return ids.map((id) => config.agentFrameworks[id]).filter(Boolean);
}

function getFrameworkOwnershipPrefixes(config, selectedFrameworkIds) {
  const allFrameworks = Object.values(config.agentFrameworks || {});
  const selectedSet = new Set(selectedFrameworkIds || allFrameworks.map((f) => f.id));

  const selectedPrefixes = new Set();
  const unselectedPrefixes = new Set();

  for (const fw of allFrameworks) {
    const bucket = selectedSet.has(fw.id) ? selectedPrefixes : unselectedPrefixes;
    for (const entry of fw.paths) {
      bucket.add(normalizeRelPath(entry.target));
    }
    if (fw.projectRulesTo) bucket.add(normalizeRelPath(fw.projectRulesTo));
    if (fw.projectSkillsTo) bucket.add(normalizeRelPath(fw.projectSkillsTo));
  }

  return {
    selectedPrefixes: [...selectedPrefixes],
    unselectedPrefixes: [...unselectedPrefixes],
  };
}

function shouldIncludeOverlayFile(relPath, selectedPrefixes, unselectedPrefixes) {
  const norm = normalizeRelPath(relPath);
  // If matched by any selected framework prefix, include it
  if (selectedPrefixes.some((p) => isPathWithin(norm, p))) {
    return true;
  }
  // If exclusively matched by an unselected framework prefix, skip it
  if (unselectedPrefixes.some((p) => isPathWithin(norm, p))) {
    return false;
  }
  // Custom repo-specific file not tied to any unselected framework: include it
  return true;
}

export function getAllManagedPaths(config) {
  const targets = new Set();

  for (const entry of config.agentSyncPaths || []) {
    targets.add(normalizeRelPath(entry.target));
  }

  for (const fw of Object.values(config.agentFrameworks || {})) {
    for (const entry of fw.paths) {
      targets.add(normalizeRelPath(entry.target));
    }
    if (fw.projectRulesTo) targets.add(normalizeRelPath(fw.projectRulesTo));
    if (fw.projectSkillsTo) targets.add(normalizeRelPath(fw.projectSkillsTo));
  }

  return [...targets].map((target) => ({ source: target, target }));
}

export function buildRepoSyncPlan(workspaceRoot, repo, config, selectedFrameworkIds = null) {
  const overlayDir = repo.overlayDir || null;
  const excludePaths = repo.excludePaths || [];
  const frameworks = collectFrameworkDefinitions(config, selectedFrameworkIds);

  const rawSyncEntries = frameworks
    ? frameworks.flatMap((fw) => fw.paths)
    : config.agentSyncPaths || [];
  const syncEntries = deduplicateSyncEntries(workspaceRoot, rawSyncEntries);

  const ruleProjections = frameworks
    ? frameworks
        .filter((fw) => fw.projectRulesTo && fw.projectRulesFormat)
        .map((fw) => ({
          targetDir: normalizeRelPath(fw.projectRulesTo),
          format: fw.projectRulesFormat,
        }))
    : [];

  const skillProjections = frameworks
    ? frameworks
        .filter((fw) => fw.projectSkillsTo)
        .map((fw) => ({
          targetDir: normalizeRelPath(fw.projectSkillsTo),
        }))
    : [];

  const expectedFiles = new Map();
  const managedDirs = new Set();
  const baseIgnoreEntries = [];
  const missingSources = [];
  let projectedRuleCount = 0;
  let projectedSkillCount = 0;

  // 1. Base shared paths for selected frameworks
  for (const { source, target } of syncEntries) {
    const sourcePath = path.join(workspaceRoot, source);
    const normTarget = normalizeRelPath(target);
    if (!fs.existsSync(sourcePath)) {
      missingSources.push(normTarget);
      continue;
    }

    const stat = fs.statSync(sourcePath);
    if (stat.isFile()) {
      baseIgnoreEntries.push(`/${normTarget}`);
      if (!isExcluded(normTarget, excludePaths)) {
        expectedFiles.set(normTarget, { kind: 'file', sourcePath, origin: 'shared' });
      }
    } else if (stat.isDirectory()) {
      managedDirs.add(normTarget);
      baseIgnoreEntries.push(`/${normTarget}/`);
      for (const file of collectFilesRecursive(sourcePath)) {
        const rel = `${normTarget}/${file.rel}`;
        if (!isExcluded(rel, excludePaths)) {
          expectedFiles.set(rel, { kind: 'file', sourcePath: file.full, origin: 'shared' });
        }
      }
    }
  }

  // 2. Collect canonical rules (.agents/rules/*.md + repo overlay .agents/rules/*.md)
  const canonicalRules = new Map();
  const sharedRulesDir = path.join(workspaceRoot, CANONICAL_RULES_DIR);
  for (const file of collectFilesRecursive(sharedRulesDir)) {
    if (!file.rel.endsWith('.md')) continue;
    const canonicalRel = `${CANONICAL_RULES_DIR}/${file.rel}`;
    if (!isExcluded(canonicalRel, excludePaths)) {
      canonicalRules.set(file.rel, file.full);
    }
  }
  if (overlayDir) {
    const overlayRulesDir = path.join(overlayDir, CANONICAL_RULES_DIR);
    for (const file of collectFilesRecursive(overlayRulesDir)) {
      if (!file.rel.endsWith('.md')) continue;
      canonicalRules.set(file.rel, file.full);
    }
  }

  for (const proj of ruleProjections) {
    if (canonicalRules.size === 0) continue;
    managedDirs.add(proj.targetDir);
    if (!isCoveredByBaseIgnore(proj.targetDir, baseIgnoreEntries)) {
      baseIgnoreEntries.push(`/${proj.targetDir}/`);
    }
    for (const [ruleRel, fullPath] of canonicalRules.entries()) {
      const targetRel = projectedRuleTargetRel(ruleRel, proj.targetDir, proj.format);
      if (isExcluded(targetRel, excludePaths)) continue;
      const rawText = fs.readFileSync(fullPath, 'utf8');
      const rendered = projectRuleContent(rawText, proj.format);
      expectedFiles.set(targetRel, {
        kind: 'generated',
        content: Buffer.from(rendered, 'utf8'),
        origin: 'projected',
      });
      projectedRuleCount += 1;
    }
  }

  // 3. Collect canonical skills (.agents/skills/** + repo overlay .agents/skills/**)
  const canonicalSkills = new Map();
  const sharedSkillsDir = path.join(workspaceRoot, CANONICAL_SKILLS_DIR);
  for (const file of collectFilesRecursive(sharedSkillsDir)) {
    const canonicalRel = `${CANONICAL_SKILLS_DIR}/${file.rel}`;
    if (!isExcluded(canonicalRel, excludePaths)) {
      canonicalSkills.set(file.rel, file.full);
    }
  }
  if (overlayDir) {
    const overlaySkillsDir = path.join(overlayDir, CANONICAL_SKILLS_DIR);
    for (const file of collectFilesRecursive(overlaySkillsDir)) {
      canonicalSkills.set(file.rel, file.full);
    }
  }

  for (const proj of skillProjections) {
    if (canonicalSkills.size === 0) continue;
    managedDirs.add(proj.targetDir);
    if (!isCoveredByBaseIgnore(proj.targetDir, baseIgnoreEntries)) {
      baseIgnoreEntries.push(`/${proj.targetDir}/`);
    }
    for (const [skillRel, fullPath] of canonicalSkills.entries()) {
      const targetRel = `${proj.targetDir}/${skillRel}`;
      if (isExcluded(targetRel, excludePaths)) continue;
      expectedFiles.set(targetRel, {
        kind: 'file',
        sourcePath: fullPath,
        origin: 'projected',
      });
      projectedSkillCount += 1;
    }
  }

  // 4. Repo-specific overlays (filtered to selected frameworks)
  const overlayApplied = [];
  const extraIgnoreEntries = [];
  const { selectedPrefixes, unselectedPrefixes } = frameworks
    ? getFrameworkOwnershipPrefixes(config, selectedFrameworkIds)
    : { selectedPrefixes: [], unselectedPrefixes: [] };

  if (overlayDir && fs.existsSync(overlayDir)) {
    for (const file of collectFilesRecursive(overlayDir)) {
      const normRel = normalizeRelPath(file.rel);
      if (frameworks && !shouldIncludeOverlayFile(normRel, selectedPrefixes, unselectedPrefixes)) {
        continue;
      }
      expectedFiles.set(normRel, { kind: 'file', sourcePath: file.full, origin: 'overlay' });
      overlayApplied.push(normRel);
      if (!isCoveredByBaseIgnore(normRel, baseIgnoreEntries)) {
        extraIgnoreEntries.push(`/${normRel}`);
      }
    }
  }

  const ignoreEntries = [...new Set([...baseIgnoreEntries, ...extraIgnoreEntries])];

  return {
    syncEntries,
    expectedFiles,
    managedDirs: [...managedDirs],
    ignoreEntries,
    missingSources,
    overlayApplied,
    projectedRuleCount,
    projectedSkillCount,
  };
}

export function readManagedBlockEntries(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const startIdx = content.indexOf(BLOCK_START);
  const endIdx = content.indexOf(BLOCK_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return [];
  return content
    .slice(startIdx + BLOCK_START.length, endIdx)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function updateManagedBlock(filePath, lines, { dryRun = false } = {}) {
  const exists = fs.existsSync(filePath);
  const original = exists ? fs.readFileSync(filePath, 'utf8') : '';

  const escapedStart = BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRegex = new RegExp(`\\n?${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'g');

  const stripped = original.replace(blockRegex, '\n').replace(/\n{3,}/g, '\n\n');
  let nextContent;

  if (!lines || lines.length === 0) {
    nextContent = stripped.trim() === '' ? '' : `${stripped.trimEnd()}\n`;
  } else {
    const block = `${BLOCK_START}\n${lines.join('\n')}\n${BLOCK_END}\n`;
    const base = stripped.trimEnd();
    nextContent = base ? `${base}\n\n${block}` : block;
  }

  if (nextContent === original) {
    return 'unchanged';
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, nextContent, 'utf8');
  }

  if (!lines || lines.length === 0) return 'removed';
  return exists ? 'updated' : 'created';
}

export function getIgnoreFilePaths(repoDir, strategy) {
  const files = [];
  if (strategy === 'gitignore' || strategy === 'both') {
    files.push(path.join(repoDir, '.gitignore'));
  }
  if (strategy === 'git-exclude' || strategy === 'both') {
    files.push(path.join(repoDir, '.git', 'info', 'exclude'));
  }
  return files;
}

export function applyIgnoreEntries(repoDir, entries, strategy, { dryRun = false } = {}) {
  const results = [];
  for (const filePath of getIgnoreFilePaths(repoDir, strategy)) {
    const status = updateManagedBlock(filePath, entries, { dryRun });
    results.push({ filePath: path.relative(repoDir, filePath), status });
  }
  return results;
}

export function removeManagedIgnoreBlocks(repoDir, { dryRun = false } = {}) {
  const results = [];
  for (const filePath of getIgnoreFilePaths(repoDir, 'both')) {
    if (!fs.existsSync(filePath)) continue;
    const status = updateManagedBlock(filePath, [], { dryRun });
    if (status === 'removed') {
      results.push({ filePath: path.relative(repoDir, filePath), status });
    }
  }
  return results;
}

export function getAllPreviouslyManagedPaths(repoDir) {
  const prev = new Set();
  for (const filePath of getIgnoreFilePaths(repoDir, 'both')) {
    for (const rawEntry of readManagedBlockEntries(filePath)) {
      const rel = normalizeRelPath(rawEntry);
      if (rel) prev.add(rel);
    }
  }
  return [...prev];
}

export function syncRepoWithPlan(repoDir, plan, strategy, { dryRun = false } = {}) {
  const nextIgnoreSet = new Set(plan.ignoreEntries.map((e) => normalizeRelPath(e)));
  const staleRemoved = [];

  // 1. Clean up any previously managed paths no longer in the active selection
  // (e.g. when a developer switches frameworks or removes an overlay).
  for (const prevRel of getAllPreviouslyManagedPaths(repoDir)) {
    if (nextIgnoreSet.has(prevRel)) continue;
    const targetPath = ensureInside(repoDir, path.join(repoDir, prevRel));
    if (!fs.existsSync(targetPath)) continue;
    if (!dryRun) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      pruneEmptyParents(path.dirname(targetPath), repoDir);
    }
    staleRemoved.push(prevRel);
  }

  // 2. Clean up stale files inside active managed directories (e.g. removed or excluded rules/skills)
  for (const dirRel of plan.managedDirs) {
    const targetDir = ensureInside(repoDir, path.join(repoDir, dirRel));
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) continue;

    for (const file of collectFilesRecursive(targetDir)) {
      const rel = `${dirRel}/${file.rel}`;
      if (plan.expectedFiles.has(rel)) continue;
      const targetPath = ensureInside(repoDir, path.join(repoDir, rel));
      if (!dryRun) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        pruneEmptyParents(path.dirname(targetPath), repoDir);
      }
      staleRemoved.push(rel);
    }
  }

  // 3. Write all expected files (shared, projected, and repo-specific overlays)
  for (const [rel, spec] of plan.expectedFiles.entries()) {
    const targetPath = ensureInside(repoDir, path.join(repoDir, rel));
    if (!dryRun) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (spec.kind === 'generated') {
        fs.writeFileSync(targetPath, spec.content);
      } else {
        fs.copyFileSync(spec.sourcePath, targetPath);
      }
    }
  }

  // 4. Update managed ignore blocks
  const ignoreResults = applyIgnoreEntries(repoDir, plan.ignoreEntries, strategy, { dryRun });

  return {
    writtenCount: plan.expectedFiles.size,
    staleRemoved,
    ignoreResults,
  };
}

export function removeAgentEntry(repoDir, { target }, { dryRun = false } = {}) {
  const targetPath = ensureInside(repoDir, path.join(repoDir, target));
  if (!fs.existsSync(targetPath)) {
    return { target, status: 'absent' };
  }

  if (!dryRun) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    pruneEmptyParents(path.dirname(targetPath), repoDir);
  }

  return { target, status: 'removed' };
}

export function removeOverlayEntries(repoDir, overlayDir, { dryRun = false } = {}) {
  const candidateRels = new Set(getAllPreviouslyManagedPaths(repoDir));
  if (overlayDir && fs.existsSync(overlayDir)) {
    for (const file of collectFilesRecursive(overlayDir)) {
      candidateRels.add(normalizeRelPath(file.rel));
    }
  }

  const removed = [];
  for (const rel of candidateRels) {
    const targetPath = ensureInside(repoDir, path.join(repoDir, rel));
    if (!fs.existsSync(targetPath)) continue;
    if (!dryRun) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      pruneEmptyParents(path.dirname(targetPath), repoDir);
    }
    removed.push(rel);
  }
  return removed;
}

export function checkRepoSyncStatus(workspaceRoot, repo, config, selectedFrameworkIds, strategy) {
  const repoDir = repo.dir;
  const plan = buildRepoSyncPlan(workspaceRoot, repo, config, selectedFrameworkIds);

  const missing = [];
  const drifted = [];
  const extra = [];

  for (const [rel, spec] of plan.expectedFiles.entries()) {
    const targetPath = path.join(repoDir, rel);
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      missing.push(rel);
      continue;
    }

    const expectedBuf =
      spec.kind === 'generated' ? spec.content : fs.readFileSync(spec.sourcePath);
    if (!expectedBuf.equals(fs.readFileSync(targetPath))) {
      drifted.push(rel);
    }
  }

  // Detect stale files inside active managed directories
  for (const dirRel of plan.managedDirs) {
    const targetDir = path.join(repoDir, dirRel);
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) continue;

    for (const file of collectFilesRecursive(targetDir)) {
      const rel = `${dirRel}/${file.rel}`;
      if (!plan.expectedFiles.has(rel)) {
        extra.push(rel);
      }
    }
  }

  // Detect leftover managed paths from previously selected frameworks
  const expectedIgnoreSet = new Set(plan.ignoreEntries.map((e) => normalizeRelPath(e)));
  for (const prevRel of getAllPreviouslyManagedPaths(repoDir)) {
    if (expectedIgnoreSet.has(prevRel)) continue;
    if (fs.existsSync(path.join(repoDir, prevRel))) {
      extra.push(prevRel);
    }
  }

  // Verify ignore blocks match exact expected entries
  const ignoreOutOfSync = [];
  for (const filePath of getIgnoreFilePaths(repoDir, strategy)) {
    const currentEntries = readManagedBlockEntries(filePath);
    const matches =
      currentEntries.length === plan.ignoreEntries.length &&
      currentEntries.every((line, idx) => line === plan.ignoreEntries[idx]);
    if (!matches) {
      ignoreOutOfSync.push(path.relative(repoDir, filePath));
    }
  }

  return {
    inSync:
      missing.length === 0 &&
      drifted.length === 0 &&
      extra.length === 0 &&
      ignoreOutOfSync.length === 0,
    missing,
    drifted,
    extra,
    ignoreOutOfSync,
    overlayCount: plan.overlayApplied.length,
  };
}
