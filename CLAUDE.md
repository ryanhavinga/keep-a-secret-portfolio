# Keep A Secret — deployment

This site is live and connected to GitHub + Cloudflare. Read this before making changes.

## Where it lives

- **GitHub repo:** https://github.com/ryanhavinga/keep-a-secret-portfolio (public)
- **Live site:** https://keepasecret.ryanhavinga2003.workers.dev/
- Deployed as a Cloudflare Worker (not classic Pages) with Git integration — every push to
  `main` auto-builds and redeploys, live within ~30-60s. No dashboard step needed.
- `gh` (GitHub CLI) is installed and already authenticated as `ryanhavinga` — `git push` and
  `gh` commands work without any login prompt.

## The push workflow

1. Make changes locally as normal.
2. Preview with `python3 -m http.server 4321` (or the browser preview tool) before pushing —
   Cloudflare will build whatever's pushed, so catch problems locally first.
3. **Do not push automatically.** Show the user the change, wait for them to explicitly say to
   push/deploy it, then:
   ```bash
   git add -A
   git commit -m "describe the change"
   git push
   ```
4. That's it — Cloudflare picks up the push on its own.

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
- `.claude/` (this tool's local session/permission state) is gitignored — never commit it.
- `.DS_Store` is gitignored too.

## Repo layout reminder

Plain static site, no build step: `index.html`, `css/styles.css`, `js/app.js` (behavior),
`js/config.js` (the file you edit for content — tracks, branding, gate password). See
`README.md` for the full editing guide and the site's design rationale.
