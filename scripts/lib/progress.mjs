const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const BAR_GRADIENT = [39, 45, 51, 50, 49, 48, 42];
const BAR_WIDTH = 24;

const useColor = () => !process.env.NO_COLOR && process.stdout.isTTY !== false;
const fg256 = (code, text) => (useColor() ? `\x1b[38;5;${code}m${text}\x1b[0m` : text);
const bold = (text) => (useColor() ? `\x1b[1m${text}\x1b[0m` : text);
const dim = (text) => (useColor() ? `\x1b[2m${text}\x1b[0m` : text);

function renderGradientBar(percent, tick, complete = false) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  if (complete) {
    return fg256(42, '━'.repeat(BAR_WIDTH));
  }

  // Shimmering pulse while connecting (0%)
  if (clamped === 0) {
    const pulsePos = tick % (BAR_WIDTH + 4);
    let bar = '';
    for (let i = 0; i < BAR_WIDTH; i += 1) {
      const dist = Math.abs(i - pulsePos);
      if (dist === 0) {
        bar += fg256(51, '━');
      } else if (dist === 1) {
        bar += fg256(39, '━');
      } else {
        bar += dim('━');
      }
    }
    return bar;
  }

  const filled = Math.max(1, Math.round((clamped / 100) * BAR_WIDTH));
  let bar = '';

  for (let i = 0; i < BAR_WIDTH; i += 1) {
    if (i < filled) {
      const colorIdx = Math.min(
        BAR_GRADIENT.length - 1,
        Math.floor((i / BAR_WIDTH) * BAR_GRADIENT.length)
      );
      const isTip = i === filled - 1 && clamped < 100;
      const char = isTip ? '╸' : '━';
      bar += fg256(isTip ? 213 : BAR_GRADIENT[colorIdx], char);
    } else {
      bar += dim('━');
    }
  }

  return bar;
}

function padRight(str, width) {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

export function createCloneProgress(repoName, nameWidth) {
  const isTTY = Boolean(process.stdout.isTTY);
  const paddedName = padRight(repoName, nameWidth);
  let targetPercent = 0;
  let displayedPercent = 0;
  let tick = 0;
  let timer = null;
  let stopped = false;

  const renderActive = () => {
    if (!isTTY || stopped) return;
    // Smoothly catch up displayedPercent toward targetPercent for fluid motion
    if (displayedPercent < targetPercent) {
      const delta = targetPercent - displayedPercent;
      displayedPercent += Math.max(1, Math.ceil(delta * 0.35));
      if (displayedPercent > targetPercent) displayedPercent = targetPercent;
    }

    const spinnerColor = BAR_GRADIENT[tick % BAR_GRADIENT.length];
    const spinner = fg256(spinnerColor, SPINNER_FRAMES[tick % SPINNER_FRAMES.length]);
    const bar = renderGradientBar(displayedPercent, tick, false);
    const pctStr = fg256(51, bold(`${String(displayedPercent).padStart(3)}%`));

    process.stdout.write(`\r\x1b[2K  ${spinner} ${bold(paddedName)} ${bar} ${pctStr}`);
    tick += 1;
  };

  const cleanupCursor = () => {
    if (isTTY) {
      process.stdout.write('\x1b[?25h');
    }
  };

  const onSignal = () => {
    stop();
    cleanupCursor();
    process.stdout.write('\n');
    process.exit(130);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  };

  if (isTTY) {
    process.stdout.write('\x1b[?25l');
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    renderActive();
    timer = setInterval(renderActive, 75);
  }

  return {
    update(percent) {
      if (percent > targetPercent) {
        targetPercent = Math.min(100, Math.round(percent));
      }
    },
    succeed() {
      stop();
      const icon = fg256(42, bold('✓'));
      const bar = renderGradientBar(100, tick, true);
      const pctStr = fg256(42, bold('100%'));
      const prefix = isTTY ? '\r\x1b[2K' : '';
      process.stdout.write(`${prefix}  ${icon} ${bold(paddedName)} ${bar} ${pctStr}\n`);
      cleanupCursor();
    },
    fail(reason) {
      stop();
      const icon = fg256(196, bold('✗'));
      const bar = fg256(196, '━'.repeat(Math.max(1, Math.round((displayedPercent / 100) * BAR_WIDTH)))) +
        dim('━'.repeat(BAR_WIDTH - Math.max(1, Math.round((displayedPercent / 100) * BAR_WIDTH))));
      const pctStr = fg256(196, bold(`${String(displayedPercent).padStart(3)}%`));
      const prefix = isTTY ? '\r\x1b[2K' : '';
      process.stdout.write(`${prefix}  ${icon} ${bold(paddedName)} ${bar} ${pctStr}\n`);
      if (reason) {
        process.stderr.write(`    ${fg256(196, reason)}\n`);
      }
      cleanupCursor();
    },
  };
}
