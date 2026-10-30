# The Vault — the door version (archived)

> **No password any more.** This version asks for a password through `js/nav.js` (`window.kasVault`), which has been
> removed from the site. To use it again, take out its `gate()` / door code and the gate markup, or bring the old
> `js/nav.js` password section back.

> **Naming.** This was written when the page was still called "The Vault": the files are `vault.html`, `css/vault.css`,
> `js/vault.js` and the content is `CONFIG.vault`. The live page is now **Demos** (`demos.html`, `css/demos.css`,
> `js/demos.js`, `CONFIG.demos`), so putting this back means either renaming it to match or using the old names.


The Vault used to open with a 3D safe door, then a wall of safe-deposit boxes. That version is
**switched off** and kept here, untouched, so it can come back. The live Vault is now a plain list
(see "The Vault" in the main README).

This folder mirrors the site's own layout, so putting it back is a copy:

```bash
cp -R archive/vault-door/. .          # run from the site's root; overwrites the simple vault.html / css/vault.css / js/vault.js
```

Then, in `index.html`, put the prefetch links for the door back (they fetched `vault.html`,
`css/vault.css`, `js/vault3d.bundle.js`, `js/vault.js` and the two posters) so the door is up the
instant it's opened. The password still works the same way: `js/nav.js` (the page pill) exposes
`window.kasVault`, which this version's `js/vault.js` uses for the door on the page itself.

The content for it is `CONFIG.vault` in `js/config.js`: `eyebrow`, `heading`, `intro`, `sealed` (the number of
locked, empty boxes after the real ones) and `tracks` — the last three of those are only read by this version.
Each track: `title`, `audio`, `duration`, optional `genre`/`bpm`/`key`/`note`, and `status`
(`'available'`, `'on hold'` or `'cut'`).

Visitors first saw the closed door; opening it ran a short sequence timed in `js/vault.js` (dial, wheel, bolts,
door swinging open, light flooding in), then they walked through into the wall of boxes. The lock sounds are
synthesised in the browser. The door played once per browser session; after that the page opened straight onto
the boxes.

> Note: this folder is part of the site, so its files are still reachable by anyone who knows the address
> (`/archive/vault-door/…`). The pages in it aren't linked from anywhere and say `noindex`, but if that matters,
> take the folder out of the repo and keep it somewhere private instead.

## The Vault door in 3D
The door is a three.js scene: a lathe-turned steel door with 120 raised ribs, a wheel, a combination
dial and a hinge, set in a brushed-panel wall with a stone floor, lit with real shadows, with a
cage gate and a room of deposit boxes behind it. The shadows of the cage bars falling across the floor
as the door swings are computed, not painted. Everything (textures included) is generated in code, so
there are no image files.

* `js/vault3d.src.js` is the source and **isn't loaded by the page**; `js/vault3d.bundle.js` (≈610 kB, three.js
  included) is what the page loads. Edit the source, rebuild, and commit both.
* To rebuild, with Node installed, from any scratch folder *outside* the repo:
  ```bash
  npm install three esbuild
  NODE_PATH=./node_modules ./node_modules/.bin/esbuild "/path/to/repo/js/vault3d.src.js" \
    --bundle --minify --format=iife --target=es2020 --legal-comments=none \
    --outfile="/path/to/repo/js/vault3d.bundle.js"
  ```
  Keep `package.json` and `node_modules` out of the repo: Cloudflare would see a `package.json` and try to
  run an install/build step on every push, and this site is deliberately build-free.
* The timeline (dial, wheel, bolts, door, camera) runs off the same `T` table in `js/vault.js` as the sounds,
  so changing a timing there moves the picture and the sound together.
* If WebGL isn't available, the visitor has *reduce motion* on, or the bundle fails to load, there is no
  door: the page opens straight onto the boxes. Nothing else on the page depends on it.
* **Posters.** `img/vault-poster-portrait.jpg` and `img/vault-poster-landscape.jpg` are stills of the closed door.
  They are the page's background from the very first frame, so there is never a blank screen while the scene
  starts up; the live scene then fades in over them. If you change how the door looks, re-make them:
  open `vault.html` at the shape you want (a phone-shaped window for the portrait one, ≈16:9 for the landscape
  one), run `copy(__vault.snapshot())` in the console, and save the pasted `data:image/jpeg;base64,…` as the JPEG.
* The pages also cross-fade into each other (`@view-transition` in `css/styles.css`), and the portfolio quietly
  prefetches the Vault's files so the door is up the moment it's opened.
* Handy while tuning: open the page with `?dpr=1` to render at 1× resolution, and in the console
  `__vault.seek(5200)` freezes the scene at 5.2 s into the opening (`__vault.debug` holds the lights and
  materials).
