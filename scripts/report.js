// Opens the Playwright HTML report, first stopping any old report server on the port.
const { execSync, spawn } = require('child_process');

const port = process.env.REPORT_PORT || '9323';

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`,
    { stdio: 'inherit' },
  );
} else {
  try { execSync(`lsof -ti tcp:${port} | xargs kill`, { stdio: 'ignore' }); } catch {}
}

spawn(`npx playwright show-report --port ${port}`, { stdio: 'inherit', shell: true });
