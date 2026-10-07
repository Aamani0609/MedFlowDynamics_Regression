// Opens the one-page test report written by scripts/summaryReporter.js.
const { exec } = require('child_process');
const path = require('path');

const report = path.resolve(__dirname, '..', 'test-report', 'report.html');
const command = process.platform === 'win32' ? `start "" "${report}"` : process.platform === 'darwin' ? `open "${report}"` : `xdg-open "${report}"`;
exec(command);
console.log(report);
