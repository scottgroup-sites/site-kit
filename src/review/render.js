export const FLAG_TYPES = ["CONFIRM", "NEW", "MADE UP", "STOCK"];
export const PHOTO_ASPECTS = ["1/1", "4/3", "3/2", "16/9", "21/9", "3/4", "2/3", "4/5"];

export const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MODES = ["show", "hide", "fail"];

function checkMode(mode) {
  if (!MODES.includes(mode)) throw new Error(`Unknown flag mode "${mode}". Use one of: ${MODES.join(", ")}`);
}

const CAMERA_SVG =
  '<svg class="site-kit-photo__icon" aria-hidden="true" focusable="false" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

export function renderFlag(content, type, note, { mode = "show" } = {}) {
  if (!FLAG_TYPES.includes(type)) throw new Error(`Unknown flag type "${type}". Use one of: ${FLAG_TYPES.join(", ")}`);
  if (!note) throw new Error(`Flag "${type}" needs a note explaining what to check`);
  checkMode(mode);
  if (mode === "hide") return String(content);
  const t = escapeHtml(type);
  const n = escapeHtml(note);
  return `<span class="site-kit-flag" data-flag="${t}" data-flag-note="${n}">${content}<span class="site-kit-flag__note" aria-hidden="true">⚑ ${t}: ${n}</span></span>`;
}

export function renderPhoto(description, aspect = "4/3", { mode = "show" } = {}) {
  if (!PHOTO_ASPECTS.includes(aspect)) {
    throw new Error(`Photo "${description}": aspect ratio must be one of ${PHOTO_ASPECTS.join(", ")}, got "${aspect}"`);
  }
  checkMode(mode);
  const ratio = `site-kit-photo--${aspect.replace("/", "x")}`;
  if (mode === "hide") {
    return `<div class="site-kit-photo site-kit-photo--clean ${ratio}" role="img" aria-label="Photo coming soon">${CAMERA_SVG}</div>`;
  }
  const d = escapeHtml(description);
  return `<div class="site-kit-photo ${ratio}" role="img" aria-label="Photo coming soon: ${d}">${CAMERA_SVG}<span class="site-kit-photo__label" aria-hidden="true">PHOTO NEEDED: ${d}</span></div>`;
}
