const MODES = ["show", "hide", "fail"];

// Local builds show flags; Cloudflare preview builds hide them; the production branch uses flags.production.
export function flagMode(env, config) {
  const override = env.SITE_KIT_FLAGS;
  if (override) {
    if (!MODES.includes(override)) throw new Error(`SITE_KIT_FLAGS must be one of ${MODES.join(", ")}, got "${override}"`);
    return override;
  }
  if (env.CF_PAGES === "1") return env.CF_PAGES_BRANCH === config.productionBranch ? config.flags.production : "hide";
  return "show";
}
