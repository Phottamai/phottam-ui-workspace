import readline from 'node:readline';
import { c } from './config.mjs';

/**
 * Interactive multi-select checkbox prompt using pure Node.js (zero dependencies).
 * Falls back to a numbered line prompt when raw TTY mode is unavailable.
 */
export async function promptMultiSelect({ title, choices, initialSelected = [] }) {
  if (!choices || choices.length === 0) {
    return [];
  }

  const initialSet = new Set(initialSelected);
  const selected = new Set(
    choices.filter((ch) => initialSet.has(ch.value)).map((ch) => ch.value)
  );
  if (selected.size === 0) {
    for (const ch of choices) selected.add(ch.value);
  }

  if (process.stdin.isTTY && process.stdout.isTTY && typeof process.stdin.setRawMode === 'function') {
    return runRawCheckboxPrompt({ title, choices, selected });
  }

  return runLinePrompt({ title, choices, selected });
}

function runRawCheckboxPrompt({ title, choices, selected }) {
  return new Promise((resolve, reject) => {
    let cursor = 0;
    let errorMsg = '';
    let renderedLines = 0;

    const render = () => {
      if (renderedLines > 0) {
        process.stdout.write(`\x1b[${renderedLines}A\x1b[0J`);
      }

      const lines = [
        c.bold(title),
        c.dim('  (↑/↓ move, Space toggle, a toggle all, Enter confirm, Ctrl+C cancel)'),
        '',
      ];

      choices.forEach((choice, idx) => {
        const isCurrent = idx === cursor;
        const isChecked = selected.has(choice.value);
        const pointer = isCurrent ? c.cyan('❯') : ' ';
        const box = isChecked ? c.green('[x]') : c.dim('[ ]');
        const label = isCurrent ? c.bold(choice.label) : choice.label;
        const desc = choice.description ? ` ${c.dim(`— ${choice.description}`)}` : '';
        lines.push(`  ${pointer} ${box} ${label}${desc}`);
      });

      if (errorMsg) {
        lines.push('', `  ${c.red(errorMsg)}`);
      }

      process.stdout.write(`${lines.join('\n')}\n`);
      renderedLines = lines.length;
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress);
      try {
        process.stdin.setRawMode(false);
      } catch {
        // ignore if already restored
      }
      process.stdin.pause();
      process.stdout.write('\x1b[?25h');
    };

    const onKeypress = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\n');
        reject(new Error('Cancelled by user.'));
        return;
      }

      if (key.name === 'escape') {
        cleanup();
        process.stdout.write('\n');
        reject(new Error('Cancelled by user.'));
        return;
      }

      if (key.name === 'up' || str === 'k') {
        cursor = (cursor - 1 + choices.length) % choices.length;
        errorMsg = '';
        render();
        return;
      }

      if (key.name === 'down' || str === 'j') {
        cursor = (cursor + 1) % choices.length;
        errorMsg = '';
        render();
        return;
      }

      if (key.name === 'space') {
        const val = choices[cursor].value;
        if (selected.has(val)) {
          selected.delete(val);
        } else {
          selected.add(val);
        }
        errorMsg = '';
        render();
        return;
      }

      if (str === 'a' || str === 'A') {
        if (selected.size === choices.length) {
          selected.clear();
        } else {
          for (const ch of choices) selected.add(ch.value);
        }
        errorMsg = '';
        render();
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (selected.size === 0) {
          errorMsg = 'Select at least one framework (press Space to toggle).';
          render();
          return;
        }
        cleanup();
        process.stdout.write('\n');
        const ordered = choices.filter((ch) => selected.has(ch.value)).map((ch) => ch.value);
        resolve(ordered);
      }
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('\x1b[?25l');
    process.stdin.on('keypress', onKeypress);
    render();
  });
}

async function runLinePrompt({ title, choices, selected }) {
  console.log(c.bold(title));
  choices.forEach((choice, idx) => {
    const mark = selected.has(choice.value) ? '*' : ' ';
    const desc = choice.description ? ` — ${choice.description}` : '';
    console.log(`  ${idx + 1}. [${mark}] ${choice.label}${desc}`);
  });

  const defaultNums = choices
    .map((ch, idx) => (selected.has(ch.value) ? idx + 1 : null))
    .filter(Boolean)
    .join(',');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise((resolve) => {
      rl.question(
        `\nEnter numbers or names (comma-separated, "all", or Enter for [${defaultNums}]): `,
        resolve
      );
    });

    const trimmed = answer.trim();
    if (!trimmed) {
      return choices.filter((ch) => selected.has(ch.value)).map((ch) => ch.value);
    }
    if (trimmed.toLowerCase() === 'all') {
      return choices.map((ch) => ch.value);
    }

    const picked = new Set();
    for (const token of trimmed.split(',').map((s) => s.trim()).filter(Boolean)) {
      const num = Number(token);
      if (Number.isInteger(num) && num >= 1 && num <= choices.length) {
        picked.add(choices[num - 1].value);
        continue;
      }
      const byName = choices.find((ch) => ch.value.toLowerCase() === token.toLowerCase());
      if (byName) {
        picked.add(byName.value);
        continue;
      }
      throw new Error(`Invalid selection "${token}".`);
    }

    if (picked.size === 0) {
      throw new Error('At least one framework must be selected.');
    }

    return choices.filter((ch) => picked.has(ch.value)).map((ch) => ch.value);
  } finally {
    rl.close();
  }
}
