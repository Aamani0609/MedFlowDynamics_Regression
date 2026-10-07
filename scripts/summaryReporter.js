// Playwright reporter that writes a single, self-contained HTML test report:
// run date and time, status charts, a run timeline, step timings and every screenshot.
// Latest run: test-report/report.html, plus a dated copy in test-report/history/.
const fs = require('fs');
const path = require('path');

const STATUS = {
  passed: { label: 'Passed', icon: '✓', color: '#0ca30c' },
  failed: { label: 'Failed', icon: '✕', color: '#d03b3b' },
  flaky: { label: 'Flaky', icon: '!', color: '#fab219' },
  skipped: { label: 'Skipped', icon: '–', color: '#8a8984' },
};

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stripAnsi = s => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

function formatDuration(ms) {
  if (ms === 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const formatDateTime = d => d.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const formatTime = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const pad = n => String(n).padStart(2, '0');
const fileStamp = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

/** Flattens the steps a reader cares about (test steps, actions, assertions) with their depth. */
function flattenSteps(steps, depth = 0, out = []) {
  for (const step of steps) {
    if (['test.step', 'pw:api', 'expect'].includes(step.category)) {
      out.push({ title: step.title, category: step.category, depth, duration: step.duration, error: step.error ? stripAnsi(step.error.message) : '' });
      flattenSteps(step.steps, depth + 1, out);
    }
  }
  return out;
}

class SummaryReporter {
  constructor(options = {}) {
    this.outputFolder = options.outputFolder || 'test-report';
    this.author = options.author || '';
    this.tests = new Map();
  }

  onBegin(config) {
    this.config = config;
    this.startTime = new Date();
    this.command = runCommand();
    this.headed = config.projects.some(p => p.use?.headless === false);
  }

  onTestEnd(test, result) {
    const outcome = test.outcome();
    const status = outcome === 'expected' ? 'passed' : outcome === 'unexpected' ? 'failed' : outcome;

    const screenshots = result.attachments
      .filter(a => a.contentType.startsWith('image/') && (a.body || (a.path && fs.existsSync(a.path))))
      .map(a => ({
        name: a.name === 'screenshot' ? 'Final screen' : a.name,
        src: `data:${a.contentType};base64,${(a.body || fs.readFileSync(a.path)).toString('base64')}`,
      }));

    // Keep only the last attempt of a retried test
    this.tests.set(test.id, {
      title: test.title,
      file: path.relative(this.config.rootDir, test.location.file).replace(/\\/g, '/'),
      line: test.location.line,
      project: test.parent.project()?.name ?? '',
      status,
      retry: result.retry,
      start: result.startTime,
      duration: result.duration,
      errors: result.errors.map(e => stripAnsi(e.message || e.value)),
      annotations: test.annotations.filter(a => a.description),
      tags: test.tags,
      testSteps: result.steps.filter(s => s.category === 'test.step').map(s => ({ title: s.title, duration: s.duration, failed: !!s.error })),
      actions: flattenSteps(result.steps),
      screenshots,
    });
  }

  onEnd(result) {
    // Nothing ran (e.g. `--list`), so keep the last real report
    if (this.tests.size === 0) return;
    const endTime = new Date();
    // Menu order: by the numbered file (01-Login ... 12-Workforce), then by position in the file
    const tests = [...this.tests.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    const html = renderReport({
      tests,
      startTime: this.startTime,
      endTime,
      duration: result.duration,
      overall: result.status,
      baseURL: this.config.projects.find(p => p.use?.baseURL)?.use.baseURL ?? '',
      projects: [...new Set(tests.map(t => t.project))],
      workers: this.config.workers,
      command: this.command,
      headed: this.headed,
      author: this.author,
    });

    const folder = path.resolve(path.dirname(this.config.configFile), this.outputFolder);
    fs.mkdirSync(path.join(folder, 'history'), { recursive: true });
    const latest = path.join(folder, 'report.html');
    fs.writeFileSync(latest, html);
    fs.writeFileSync(path.join(folder, 'history', `report-${fileStamp(this.startTime)}.html`), html);
    console.log(`\nTest report: ${latest}`);
  }

  printsToStdio() {
    return false;
  }
}

/* ---------- charts (inline SVG) ---------- */

function donutChart(counts, total) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const gap = total > 1 ? 3 : 0;
  let offset = 0;
  const segments = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const len = (n / total) * c;
      const seg = `<circle class="tip" cx="90" cy="90" r="${r}" fill="none" stroke="${STATUS[key].color}" stroke-width="22"
        stroke-dasharray="${Math.max(len - gap, 0.1)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"
        data-tip="${STATUS[key].label}: ${n} of ${total} (${Math.round((n / total) * 100)}%)"></circle>`;
      offset += len;
      return seg;
    })
    .join('');
  const passRate = total ? Math.round((counts.passed / total) * 100) : 0;
  return `<svg viewBox="0 0 180 180" class="donut" role="img" aria-label="${passRate}% of tests passed">
    <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--grid)" stroke-width="22"></circle>${segments}
    <text x="90" y="88" text-anchor="middle" class="donut-value">${passRate}%</text>
    <text x="90" y="110" text-anchor="middle" class="donut-label">pass rate</text>
  </svg>`;
}

/** Gantt-style view of when each test ran during the run. */
function timelineChart(tests, runStart, runMs) {
  const labelW = 330, plotW = 600, rowH = 30, top = 10, axisH = 28;
  const height = top + tests.length * rowH + axisH;
  const span = Math.max(runMs, ...tests.map(t => t.start - runStart + t.duration), 1);
  const x = ms => labelW + (ms / span) * plotW;

  const ticks = [];
  const step = niceStep(span / 5);
  for (let t = 0; t <= span; t += step) ticks.push(t);

  const grid = ticks.map(t => `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${top + tests.length * rowH}" class="gridline"></line>
    <text x="${x(t)}" y="${top + tests.length * rowH + 18}" text-anchor="middle" class="axis">${formatDuration(t)}</text>`).join('');

  const rows = tests.map((t, i) => {
    const y = top + i * rowH;
    const startMs = t.start - runStart;
    const w = Math.max((t.duration / span) * plotW, 3);
    const label = t.title.length > 46 ? `${t.title.slice(0, 45)}…` : t.title;
    return `<text x="${labelW - 10}" y="${y + rowH / 2 + 4}" text-anchor="end" class="row-label">${escapeHtml(label)}</text>
      <rect class="tip" x="${x(startMs)}" y="${y + 6}" width="${w}" height="${rowH - 12}" rx="4" fill="${STATUS[t.status].color}"
        data-tip="${escapeHtml(t.title)}&#10;${STATUS[t.status].label} · ${formatDuration(t.duration)}&#10;${formatTime(t.start)} → ${formatTime(new Date(t.start.getTime() + t.duration))}"></rect>`;
  }).join('');

  return `<svg viewBox="0 0 ${labelW + plotW + 20} ${height}" class="chart" role="img" aria-label="Timeline of when each test ran">${grid}${rows}</svg>`;
}

/** Horizontal bars, one per item, labelled with their value. */
function barChart(items, ariaLabel) {
  const labelW = 330, plotW = 520, rowH = 30, top = 4;
  const max = Math.max(...items.map(i => i.value), 1);
  const height = top + items.length * rowH + 4;
  const rows = items.map((item, i) => {
    const y = top + i * rowH;
    const w = Math.max((item.value / max) * plotW, 3);
    const label = item.label.length > 46 ? `${item.label.slice(0, 45)}…` : item.label;
    return `<text x="${labelW - 10}" y="${y + rowH / 2 + 4}" text-anchor="end" class="row-label">${escapeHtml(label)}</text>
      <rect class="tip" x="${labelW}" y="${y + 6}" width="${w}" height="${rowH - 12}" rx="4" fill="${item.color || 'var(--series-1)'}"
        data-tip="${escapeHtml(item.label)}&#10;${escapeHtml(item.tip || formatDuration(item.value))}"></rect>
      <text x="${labelW + w + 8}" y="${y + rowH / 2 + 4}" class="value">${escapeHtml(item.valueLabel || formatDuration(item.value))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${labelW + plotW + 90} ${height}" class="chart" role="img" aria-label="${escapeHtml(ariaLabel)}">${rows}</svg>`;
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/* ---------- page ---------- */

function statusBadge(status) {
  const s = STATUS[status];
  return `<span class="badge badge-${status}"><span aria-hidden="true">${s.icon}</span> ${s.label}</span>`;
}

function renderTest(t, index) {
  const steps = t.testSteps.length
    ? `<h4>Steps</h4><div class="chart-wrap">${barChart(t.testSteps.map(s => ({
        label: s.title,
        value: s.duration,
        color: s.failed ? STATUS.failed.color : 'var(--series-1)',
        valueLabel: `${s.failed ? '✕ ' : ''}${formatDuration(s.duration)}`,
      })), `Step durations for ${t.title}`)}</div>`
    : '';

  const errors = t.errors.length ? `<div class="error"><strong>Error</strong><pre>${escapeHtml(t.errors.join('\n\n'))}</pre></div>` : '';
  const notes = t.annotations.map(a => `<div class="note"><strong>${escapeHtml(a.type)}:</strong> ${escapeHtml(a.description)}</div>`).join('');

  const actions = t.actions.length
    ? `<details><summary>All ${t.actions.length} actions and checks</summary><ol class="actions">${t.actions.map(a => `
        <li class="${a.error ? 'failed' : ''}" style="padding-left:${a.depth * 18}px">
          <span class="cat cat-${a.category.replace(/\W/g, '')}">${a.category === 'test.step' ? 'step' : a.category === 'expect' ? 'check' : 'action'}</span>
          ${escapeHtml(a.title)} <span class="muted">${formatDuration(a.duration)}</span>
        </li>`).join('')}</ol></details>`
    : '';

  const shots = t.screenshots.length
    ? `<h4>Screenshots (${t.screenshots.length})</h4><div class="shots">${t.screenshots.map((s, i) => `
        <figure><button type="button" class="shot" data-full="t${index}s${i}" aria-label="Open screenshot: ${escapeHtml(s.name)}">
          <img id="t${index}s${i}" src="${s.src}" alt="${escapeHtml(s.name)}" loading="lazy"></button>
          <figcaption>${i + 1}. ${escapeHtml(s.name)}</figcaption></figure>`).join('')}</div>`
    : '';

  return `<article class="test" data-status="${t.status}">
    <header class="test-head">
      ${statusBadge(t.status)}
      <h3>${escapeHtml(t.title)}</h3>
    </header>
    <dl class="meta">
      <div><dt>File</dt><dd>${escapeHtml(t.file)}:${t.line}</dd></div>
      <div><dt>Project</dt><dd>${escapeHtml(t.project)}</dd></div>
      <div><dt>Started</dt><dd>${formatDateTime(t.start)}</dd></div>
      <div><dt>Duration</dt><dd>${formatDuration(t.duration)}</dd></div>
      ${t.retry ? `<div><dt>Retry</dt><dd>${t.retry}</dd></div>` : ''}
    </dl>
    ${notes}${errors}${steps}${shots}${actions}
  </article>`;
}

/**
 * How this run was started, e.g. "npm run test:workforce:headed" (with the playwright command it runs),
 * or the npx playwright command line.
 */
function runCommand() {
  const event = process.env.npm_lifecycle_event;
  const script = process.env.npm_lifecycle_script;
  if (event && event !== 'npx' && script) {
    return { command: `npm run ${event}`, runs: script };
  }
  return { command: `npx playwright ${process.argv.slice(2).join(' ')}`.trim(), runs: '' };
}

function renderReport({ tests, startTime, endTime, duration, overall, baseURL, projects, workers, command, headed, author }) {
  // A run where every test carries the @regression tag is the regression suite
  const isRegression = tests.length > 0 && tests.every(t => t.tags.includes('@regression'));
  const suiteName = isRegression ? 'Regression' : 'Test';
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const t of tests) counts[t.status]++;
  const total = tests.length;

  const byFile = Object.values(tests.reduce((acc, t) => {
    acc[t.file] ??= { label: t.file, value: 0, n: 0, failed: 0 };
    acc[t.file].value += t.duration;
    acc[t.file].n++;
    if (t.status === 'failed') acc[t.file].failed++;
    return acc;
  }, {})).map(f => ({ ...f, tip: `${f.n} test${f.n > 1 ? 's' : ''} · ${formatDuration(f.value)}${f.failed ? ` · ${f.failed} failed` : ''}` }));

  const legend = Object.entries(counts).map(([k, n]) => `
    <li><span class="swatch" style="background:${STATUS[k].color}"></span><span aria-hidden="true">${STATUS[k].icon}</span> ${STATUS[k].label} <strong>${n}</strong></li>`).join('');

  const resultRows = tests.map((t, i) => `<tr>
      <td>${statusBadge(t.status)}</td>
      <td><a href="#test-${i}">${escapeHtml(t.title)}</a></td>
      <td>${escapeHtml(t.file)}</td>
      <td>${formatTime(t.start)}</td>
      <td class="num">${formatDuration(t.duration)}</td>
      <td class="num">${t.screenshots.length}</td>
    </tr>`).join('');

  const overallStatus = counts.failed ? 'failed' : counts.flaky ? 'flaky' : total ? 'passed' : 'skipped';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Medflow ${suiteName} Report</title>
<style>
:root {
  --surface: #f6f6f4; --card: #fcfcfb; --border: #e3e2dc; --grid: #ebeae5;
  --text: #0b0b0b; --text-2: #52514e; --muted: #7a7974;
  --series-1: #2a78d6; --accent: #2a78d6;
  --err-bg: #fdf0f0; --err-border: #f0c4c4; --note-bg: #fff8e6; --note-border: #f3dc9a;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --surface: #121211; --card: #1a1a19; --border: #33322f; --grid: #2a2a28;
    --text: #ffffff; --text-2: #c3c2b7; --muted: #95948c;
    --series-1: #3987e5; --accent: #5a9cec;
    --err-bg: #2a1616; --err-border: #5a2a2a; --note-bg: #2a2412; --note-border: #5a4a1e;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --surface: #121211; --card: #1a1a19; --border: #33322f; --grid: #2a2a28;
  --text: #ffffff; --text-2: #c3c2b7; --muted: #95948c;
  --series-1: #3987e5; --accent: #5a9cec;
  --err-bg: #2a1616; --err-border: #5a2a2a; --note-bg: #2a2412; --note-border: #5a4a1e;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.01em; }
h2 { font-size: 18px; margin: 0 0 16px; }
h3 { font-size: 16px; margin: 0; }
h4 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-2); margin: 24px 0 8px; }
.sub { color: var(--text-2); margin: 0 0 24px; }
.suite-banner { display: inline-block; margin: 0 0 12px; padding: 6px 16px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.author { color: var(--text); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
.run-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 24px; margin: 0; }
.run-command { grid-column: 1 / -1; }
code { font: 13px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; }
.run-meta dt, .meta dt { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.run-meta dd, .meta dd { margin: 2px 0 0; font-weight: 500; overflow-wrap: anywhere; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
.tile { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.tile .label { font-size: 13px; color: var(--text-2); display: flex; align-items: center; gap: 6px; }
.tile .value { font-size: 30px; font-weight: 650; margin-top: 4px; font-variant-numeric: tabular-nums; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.overview { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: center; }
@media (max-width: 640px) { .overview { grid-template-columns: 1fr; justify-items: center; } }
.donut { width: 200px; height: 200px; }
.donut-value { font-size: 30px; font-weight: 650; fill: var(--text); }
.donut-label { font-size: 12px; fill: var(--text-2); }
.legend { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.legend li { display: flex; align-items: center; gap: 8px; color: var(--text-2); }
.legend strong { color: var(--text); margin-left: auto; font-variant-numeric: tabular-nums; min-width: 2ch; text-align: right; }
.swatch { width: 12px; height: 12px; border-radius: 3px; }
.chart-wrap { overflow-x: auto; }
.chart { width: 100%; min-width: 640px; height: auto; display: block; }
.gridline { stroke: var(--grid); stroke-width: 1; }
.axis { font-size: 11px; fill: var(--muted); }
.row-label { font-size: 12px; fill: var(--text-2); }
.value { font-size: 12px; fill: var(--text); font-variant-numeric: tabular-nums; }
.tip { cursor: default; }
.tip:hover { opacity: .85; }
#tooltip { position: fixed; pointer-events: none; background: var(--text); color: var(--card); padding: 6px 10px; border-radius: 6px; font-size: 12px; white-space: pre-line; max-width: 320px; opacity: 0; transition: opacity .1s; z-index: 10; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
th { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.table-wrap { overflow-x: auto; }
a { color: var(--accent); }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; border: 1px solid; }
.badge-passed { color: #0a7a0a; border-color: #0ca30c; background: #0ca30c14; }
.badge-failed { color: #b02a2a; border-color: #d03b3b; background: #d03b3b14; }
.badge-flaky { color: #8a5d00; border-color: #fab219; background: #fab21922; }
.badge-skipped { color: var(--text-2); border-color: #8a8984; background: #8a898414; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .badge-passed { color: #5fd35f; } :root:not([data-theme="light"]) .badge-failed { color: #f08080; } :root:not([data-theme="light"]) .badge-flaky { color: #fab219; } }
:root[data-theme="dark"] .badge-passed { color: #5fd35f; } :root[data-theme="dark"] .badge-failed { color: #f08080; } :root[data-theme="dark"] .badge-flaky { color: #fab219; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.filters button { font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--text-2); cursor: pointer; }
.filters button[aria-pressed="true"] { background: var(--text); color: var(--card); border-color: var(--text); }
.test { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; scroll-margin-top: 16px; }
.test[data-status="failed"] { border-left: 4px solid #d03b3b; }
.test-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 32px; margin: 14px 0 0; }
.error { background: var(--err-bg); border: 1px solid var(--err-border); border-radius: 8px; padding: 12px 14px; margin-top: 16px; }
.error pre { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12.5px; }
.note { background: var(--note-bg); border: 1px solid var(--note-border); border-radius: 8px; padding: 10px 14px; margin-top: 16px; font-size: 14px; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
figure { margin: 0; }
.shot { display: block; width: 100%; padding: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); cursor: zoom-in; aspect-ratio: 16 / 10; }
.shot img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
figcaption { font-size: 12.5px; color: var(--text-2); margin-top: 6px; }
details { margin-top: 20px; }
summary { cursor: pointer; color: var(--accent); font-size: 14px; }
.actions { list-style: none; padding: 0; margin: 10px 0 0; font-size: 13px; max-height: 420px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
.actions li { padding: 5px 10px; border-bottom: 1px solid var(--grid); overflow-wrap: anywhere; }
.actions li.failed { background: var(--err-bg); }
.cat { display: inline-block; min-width: 50px; font-size: 11px; color: var(--muted); text-transform: uppercase; }
.cat-teststep { color: var(--accent); font-weight: 600; }
.muted { color: var(--muted); }
dialog { border: none; padding: 0; background: transparent; max-width: 96vw; max-height: 96vh; }
dialog::backdrop { background: rgb(0 0 0 / .8); }
dialog img { max-width: 96vw; max-height: 90vh; display: block; border-radius: 6px; }
dialog p { color: #fff; margin: 8px 0 0; font-size: 14px; }
footer { color: var(--muted); font-size: 13px; text-align: center; margin-top: 32px; }
</style>
</head>
<body>
<main>
  ${isRegression ? '<p class="suite-banner">Regression Suite</p>' : ''}
  <h1>Medflow Dynamics · ${suiteName} Report</h1>
  <p class="sub">Run on ${formatDateTime(startTime)} &nbsp;${statusBadge(overallStatus)}${author ? ` &nbsp;·&nbsp; Created by <strong class="author">${escapeHtml(author)}</strong>` : ''}</p>

  <section class="card">
    <dl class="run-meta">
      <div><dt>Started</dt><dd>${formatDateTime(startTime)}</dd></div>
      <div><dt>Finished</dt><dd>${formatDateTime(endTime)}</dd></div>
      <div><dt>Total time</dt><dd>${formatDuration(duration)}</dd></div>
      <div><dt>Environment</dt><dd>${escapeHtml(baseURL)}</dd></div>
      <div><dt>Projects</dt><dd>${escapeHtml(projects.join(', '))}</dd></div>
      <div><dt>Workers</dt><dd>${workers}</dd></div>
      <div><dt>Browser</dt><dd>Firefox · ${headed ? 'headed (visible window)' : 'headless'}</dd></div>
      <div class="run-command"><dt>Run command</dt><dd><code>${escapeHtml(command.command)}</code>${command.runs ? `<span class="muted"> → ${escapeHtml(command.runs)}</span>` : ''}</dd></div>
    </dl>
  </section>

  <section class="tiles" aria-label="Summary">
    <div class="tile"><div class="label">Total tests</div><div class="value">${total}</div></div>
    ${Object.entries(counts).map(([k, n]) => `<div class="tile"><div class="label"><span class="dot" style="background:${STATUS[k].color}"></span>${STATUS[k].icon} ${STATUS[k].label}</div><div class="value">${n}</div></div>`).join('')}
  </section>

  <section class="card">
    <h2>Results overview</h2>
    <div class="overview">
      ${donutChart(counts, total || 1)}
      <ul class="legend">${legend}</ul>
    </div>
  </section>

  <section class="card">
    <h2>Run timeline</h2>
    <p class="sub" style="margin-top:-8px">When each test started and how long it took, measured from the start of the run.</p>
    <div class="chart-wrap">${timelineChart(tests, startTime, duration)}</div>
  </section>

  <section class="card">
    <h2>Time per spec file</h2>
    <div class="chart-wrap">${barChart(byFile, 'Total time per spec file')}</div>
  </section>

  <section class="card">
    <h2>All results</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>Status</th><th>Test</th><th>File</th><th>Started</th><th class="num">Duration</th><th class="num">Screens</th></tr></thead>
      <tbody>${resultRows}</tbody>
    </table></div>
  </section>

  <h2 style="margin-top:32px">Test details</h2>
  <div class="filters" role="group" aria-label="Filter tests">
    <button type="button" data-filter="all" aria-pressed="true">All ${total}</button>
    ${Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `<button type="button" data-filter="${k}" aria-pressed="false">${STATUS[k].icon} ${STATUS[k].label} ${n}</button>`).join('')}
  </div>
  ${tests.map((t, i) => renderTest(t, i).replace('<article class="test"', `<article id="test-${i}" class="test"`)).join('')}

  <footer>${suiteName} report generated ${formatDateTime(endTime)}${author ? ` by ${escapeHtml(author)}` : ''} · overall result: ${escapeHtml(overall)}</footer>
</main>

<div id="tooltip" role="tooltip"></div>
<dialog id="lightbox"><img alt=""><p></p></dialog>

<script>
  const tooltip = document.getElementById('tooltip');
  document.addEventListener('mousemove', e => {
    const el = e.target.closest('.tip');
    if (!el) { tooltip.style.opacity = 0; return; }
    tooltip.textContent = el.dataset.tip;
    tooltip.style.opacity = 1;
    const x = Math.min(e.clientX + 14, window.innerWidth - tooltip.offsetWidth - 8);
    tooltip.style.left = x + 'px';
    tooltip.style.top = (e.clientY + 14) + 'px';
  });

  const lightbox = document.getElementById('lightbox');
  document.addEventListener('click', e => {
    const shot = e.target.closest('.shot');
    if (shot) {
      const img = document.getElementById(shot.dataset.full);
      lightbox.querySelector('img').src = img.src;
      lightbox.querySelector('p').textContent = img.alt;
      lightbox.showModal();
    } else if (e.target.closest('#lightbox')) {
      lightbox.close();
    }
  });

  document.querySelectorAll('.filters button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.filters button').forEach(b => b.setAttribute('aria-pressed', b === btn));
    document.querySelectorAll('.test').forEach(t => {
      t.hidden = btn.dataset.filter !== 'all' && t.dataset.status !== btn.dataset.filter;
    });
  }));
</script>
</body>
</html>`;
}

module.exports = SummaryReporter;
