import { execSync } from 'child_process';

/** Space Firefox's own frame and toolbars take around the page (measured on Windows). */
const FIREFOX_CHROME = { width: 14, height: 92 };

/**
 * Returns a viewport that makes the Firefox window fill the screen's usable area (excluding the taskbar).
 * Firefox has no "start maximized" switch, so the window is sized through the viewport instead.
 * Falls back to 1920x1080 when the screen size can't be read (e.g. on CI or non-Windows machines).
 */
export function maximizedViewport() {
  let width = 1920;
  let height = 1040;
  if (process.platform === 'win32') {
    try {
      const out = execSync(
        'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $a = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; \\"$($a.Width)x$($a.Height)\\""',
        { encoding: 'utf8', timeout: 15000 },
      ).trim();
      const [w, h] = out.split('x').map(Number);
      if (w > 0 && h > 0) {
        width = w;
        height = h;
      }
    } catch {
      // keep the fallback size
    }
  }
  return { width: width - FIREFOX_CHROME.width, height: height - FIREFOX_CHROME.height };
}
