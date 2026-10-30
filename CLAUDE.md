# Keep A Secret — deployment

This site is live and connected to GitHub + Cloudflare. Read this before making changes.

## Where it lives

- **GitHub repo:** https://github.com/ryanhavinga/keep-a-secret-portfolio (public)
- **Primary URL — the one to actually hand out:** https://demo-portal.keepasecret.nl
  This is what gets sent to A&Rs and labels.
- **Also live, same site:** https://keepasecret.nl — both are Custom Domains on the same
  Worker, serving the identical deployment. Bought through Yourname, DNS delegated to
  Cloudflare (nameservers `noor.ns.cloudflare.com` / `rustam.ns.cloudflare.com`).
- The Worker's default `keepasecret.ryanhavinga2003.workers.dev` URL is deliberately disabled
  (Worker URL toggle off in Domains & Routes), and GitHub Pages is disabled too (was briefly,
  accidentally live at the same domain via a `CNAME` file — removed; Pages source is "None").
- **www.keepasecret.nl** should redirect to the bare domain via a Cloudflare Redirect Rule
  (Rules → Redirect Rules) plus a proxied `www` CNAME in DNS — still not set up as of this
  writing; nothing in this repo depends on it.
- Deployed as a Cloudflare Worker (not classic Pages) with Git integration — every push to
  `main` auto-builds and redeploys, live within ~30-60s. No dashboard step needed.
- Domain/DNS/Custom Domain changes happen in the Cloudflare dashboard by hand — no API token
  is configured here (`wrangler whoami` is unauthenticated), so these can only be talked
  through, not done directly from a session.
- `gh` (GitHub CLI) is installed and already authenticated as `ryanhavinga` — `git push` and
  `gh` commands work without any login prompt.

## The push workflow

**Never push (or commit) unless the user explicitly says so in that moment** (instruction given
2026-10-08, replacing the earlier "push immediately once good" standing permission from
2026-08-05). Build and verify locally, show the result, then wait for a clear "push it".

1. Make changes locally as normal.
2. Preview with `python3 -m http.server 4321` (or the browser preview tool) and verify the
   change actually works before pushing — Cloudflare will build whatever's pushed, so this is
   the only check that happens before it's live.
3. Only when the user explicitly says to push:
   ```bash
   git add -A
   git commit -m "describe the change"
   git push
   ```
4. That's it — Cloudflare picks up the push on its own, live within ~30-60s at both
   demo-portal.keepasecret.nl and keepasecret.nl.

Even with a go-ahead, ask separately before anything destructive or hard to reverse
(force-push, history rewrite, deleting tracked files wholesale).

## Things that will break the deploy if forgotten

- **Audio files must stay under 25MB each** — Cloudflare rejects any single file over that.
  The original WAV masters (25-52MB) are gitignored (`audio/*.wav`) and never committed.
  `js/config.js` points at `.m4a` copies instead (256kbps AAC, ~5-7MB each).
- **To add/replace a track:** drop the new WAV in `audio/`, then convert it —
  ```bash
  afconvert -f m4af -d aac -b 256000 -q 127 -s 2 "master.wav" "track.m4a"
  ```
  (macOS's `afconvert` can *read* MP3 but has no MP3 *encoder* — this produces AAC, which
  plays natively in every modern browser. Don't try `-f MPG3` for output, it fails.) Then point
  the track's `audio:` field in `js/config.js` at the new `.m4a`, and commit only the `.m4a`.
- **Never add a `package.json`, `node_modules` or a build step to the repo.** Cloudflare would start
  running an install/build on every push. The old 3D-door vault page (`archive/vault-door/`, switched off) has a prebuilt
  three.js bundle, built outside the repo — see `archive/vault-door/README.md`.
- `.claude/` (this tool's local session/permission state) is gitignored — never commit it.
- `.DS_Store` is gitignored too.

## Repo layout reminder

Plain static site, no build step: `index.html` (the landing page: the portfolio), `demos.html`, `css/styles.css`, `js/portfolio.js` (behavior; the switched-off Player page and its `js/app.js` are in `archive/player/`),
`js/config.js` (the file you edit for content — tracks, branding, the demos). See
`README.md` for the full editing guide and the site's design rationale.
