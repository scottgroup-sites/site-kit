import { chromium } from "playwright-core";

// Installed Google Chrome by default (no download); Microsoft Edge on Windows if Chrome is missing.
// PW_CHANNEL overrides: "bundled" uses Playwright's own Chromium, anything else is a channel name.
export async function launchBrowser() {
  const channel = process.env.PW_CHANNEL;
  if (channel) return chromium.launch(channel === "bundled" ? {} : { channel });
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (err) {
    if (process.platform === "win32") {
      try {
        return await chromium.launch({ channel: "msedge" });
      } catch (edgeErr) {
        throw new Error(`Couldn't start Google Chrome or Microsoft Edge for the browser checks. Install one of them, or set PW_CHANNEL. (${edgeErr.message})`);
      }
    }
    throw new Error(`Couldn't start Google Chrome for the browser checks. Install Chrome, or set PW_CHANNEL. (${err.message})`);
  }
}
