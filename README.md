# KEEP A SECRET — private listening room

A static site. No build step, no dependencies. Open `index.html` in a browser, or drop the
whole folder onto any host (Netlify, Vercel, Cloudflare Pages, plain FTP).

```
index.html
css/styles.css      all styling
js/config.js        ← everything you normally edit lives here
js/app.js           carousel, player, grain
img/                artwork
audio/              your audio files
fonts/              Monument Extended
```

## Run it locally

Open `index.html` directly, or — better — serve it, so the player can sample the real
dominant colour out of each artwork:

```bash
python3 -m http.server 4321
```

Then visit `http://localhost:4321`.

> Opening the file straight off disk (`file://`) works fine, but browsers block reading
> image pixels from local files, so the panel falls back to the `color` value written in
> `js/config.js` for each track. Those fallbacks are already set to match your covers.

## Editing

Everything below is in **`js/config.js`**.

### Logo
```js
brand: { logo: 'Keep A Secret', sublogo: 'Portfolio', logoImage: null, tagline: 'Private Session' }
```
`sublogo` is the smaller line underneath — set it to `null` to hide it.
Set `logoImage: 'img/logo.svg'` to swap the whole wordmark for an image.

### Tracks
```js
{
  title: 'Nergens Liever',
  artist: 'Gilles',
  artwork: 'img/track-1.jpg',                     // square image — 1000×1000 is plenty
  audio: 'audio/track 1 - Nergens Liever.m4a',
  color: '#9d386f',                              // fallback panel colour
  duration: 194                                  // fallback length in seconds
}
```

* **Artwork** — drop a square file in `img/` and point `artwork` at it. Each image drives two
  colours: the player panel takes a muted, darkened version of its dominant colour, and the
  ring of light behind everything takes a bright, saturated one. Both cross-fade on a track
  change. The covers either side of the playing one are the previous and next tracks; clicking
  one switches to it.
* `artist` is the only credit shown under the title, centred on its own.
* **DEMO card** — set `artwork: null` and the track shows the black *DEMO* placeholder
  instead. That's *Hoogtes* today. A track with no artwork has no colour to borrow, so the
  room lights itself with its own near-white house lamp instead of sampling the cover.
* **Audio** — drop files in `audio/` and point `audio` at them. Spaces in filenames are fine.
  Until a file is there the player runs a preview timeline and shows a small
  *audio pending* line under the controls; both disappear the moment real audio loads.
* Add or remove tracks freely — the array length is the only thing that matters.

> **On file size:** the tracks ship as 256 kbps AAC (`.m4a`), roughly 5-7 MB each — no audible
> difference on the kind of speakers an A&R exec uses, and small enough for Cloudflare Pages
> (and most hosts), which reject any single file over 25 MB. The original WAV masters are
> gitignored (`audio/*.wav`) rather than committed; keep them on your own machine. To make more
> `.m4a` files from a WAV master, `afconvert` ships with macOS:
> ```
> afconvert -f m4af -d aac -b 256000 -q 127 -s 2 "master.wav" "track.m4a"
> ```
> (macOS's `afconvert` can *read* MP3 but has no MP3 *encoder* — AAC is what it actually
> produces. For true `.mp3` output, encode with `ffmpeg` or a DAW's export instead.)

### The Vault (`vault.html`)
A second page for finished songs that are still available for an artist to cut, kept apart
from the portfolio above (released records). Linked as "The Vault" top-right on the portfolio.
Its content is `vault` in `js/config.js`: one entry per song (`title`, `audio`, `duration`,
optional `genre`/`bpm`/`key`/`note`, and `status`: `'available'`, `'on hold'` or `'cut'`), plus
`sealed`, the number of locked, empty boxes shown after the real ones.

Visitors first see a closed vault door, a real 3D model (see below). Opening it runs
a short sequence timed in `js/vault.js`: the dial turns, the wheel spins, the bolts pull back, the door
swings open and light floods in from inside, then you walk through into the wall of boxes. The
lock sounds are synthesised in the browser, so there are no audio files for them. The door only
plays once per browser session; after that the page opens straight onto the boxes. The page uses
the same password gate as the portfolio, and one entry covers both pages.

#### The Vault door in 3D
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

### Portfolio (`portfolio.html`)
Everything we've made, on its own page: the covers stand upright in a row, each turned toward the middle, so
the ones in the centre are seen almost edge-on (just the spine, with the title running up it) and each one
further out shows more of its face, all from one perspective. The row sizes itself from
the window — height sets how big the covers are, width how far apart — so **all of it is in view at once**,
no scrolling (`--w`, `--p` in `css/portfolio.css`). Hovering a cover's **spine** (the side with the title on it) lifts it clearly, with only a hint of a wave in its
neighbours; the artwork itself doesn't lift anything, so there is one small, exact place to be for each cover
(mouse and trackpad only; the height is `--y` in `css/portfolio.css`, the width of the swell is `SPREAD` in
`js/portfolio.js`). Clicking one pulls it out of the row and turns it to face you,
large, with its title and artist on the right (and a play button and timeline if it has audio). Back / Esc /
the arrows step out and along.

Covers are deliberately *not* in one shared 3D space: each is drawn on its own, in a set order (nearest the
middle on top, the hovered one above all), so two covers can never intersect or flicker against each other.
Don't put `transform-style: preserve-3d` on `.shelf` — that is what would bring the glitching back.

**Filling the row out.** With "All" chosen the set runs round again from the start until the row holds
`CONFIG.portfolio.fill` covers (default 10: 7 tracks → the first 3 appear a second time; it never cuts real
tracks). The extras are the same releases, so any of them opens that release, and only the first run is exposed to
screen readers and the keyboard. The pill at the top (`All · Gilles · Rosalie · Tim Tiago`, built from the artists
in the list, most releases first) filters the row: the covers on show sink out of the bottom and the artist's own
releases, once each, rise back in across the full width. Set `fill` to the number of tracks to show each exactly
once.

The player on the front page is for what we *feature*; this page is the whole catalogue. It's
`CONFIG.portfolio` in `js/config.js` — one line per track: `title`, `artist`, `artwork`, a fallback `color`,
optional `audio`, `year`, `note`, `links`. The tint of each sleeve edge is sampled from its artwork. Linked
from "Portfolio" top-right on the player page; same password as the player.

**Artwork wants to be big:** the cover is shown up to ≈700 px wide and the screens it's seen on are mostly
2×, so aim for **1400–2000 px square** JPEGs (under ≈500 KB each). Replace a file in `img/` under the same name
and the page picks it up. Apple Music is a good source: take the cover's image URL and swap the size at the
end (`…/600x600bb.jpg`) for `3000x3000bb.jpg`. (Spotify tops out at 640 px.) The link-preview image for the
front page (`img/og-preview.jpg`, ≈300 KB) is kept separate and light on purpose, because some apps drop
previews over ≈300 KB.

### For publishers (`publishing.html`)
A plain, scrolling list of English-language demos for the publishing team, under one "Demos" heading, in the
player's own type, play button and timeline. It has its own password: typing **HAP** at the door on the portfolio (or on the Vault)
sends you straight here instead, and doesn't open either of those. The door on this page accepts only HAP,
and HAP opens only this page. Everything is in `js/config.js`: the password is `gate.redirects`, the songs
are `publishing.tracks` (title, artist, genre, a note, `audio`). A row with
`audio: null` shows "Audio to follow". Playing one stops the last; when one ends the next starts.

> The four rows in `publishing.tracks` are **placeholders**. Swap in the real demos before sharing it.

### Footer credit
"© Keep A Secret. All Rights Reserved" and "Written & produced by Keep A Secret" sit fixed,
centred at the very bottom of the page — set directly in `index.html` (`.footer-credit`), not
in `js/config.js`. Site-wide rather than per-track, so there's nothing to edit per song; change
the text in the markup itself if it ever needs to say something else.

### TikTok and Bio — removed from the page
Both panels were taken out of `index.html`. Their settings are still in `js/config.js`
(`tiktok`, `bio`) and their content is intact, but nothing reads them: `app.js` only fills in
markup that is actually present. Putting either back means restoring its `<article>` block,
its styles, its `fillContent` branch, and adding its name to `order` below.

> **The contact address lives in `bio.contact` and is no longer shown anywhere on the site.**
> The top-right "CONTACT" label is `brand.tagline` — plain text, not a link. If people are
> meant to be able to reach you from this page, that needs somewhere to go.

### Panel order
```js
order: ['player']
```
One entry now. The carousel still works with several, but with one panel it holds still and
the small transport buttons and the keyboard step through tracks instead.

## Navigating

The small transport buttons, ←/→, swiping, and clicking a cover tucked in behind the playing
one all step through tracks — there are no sections left to move between. Swiping (over the
artwork or the title/artist itself) is Apple Music-style: the title/artist carousel tracks the
drag live, while the artwork sits still and only ever swaps once a track change actually lands
— see the notes on `.cover` and `.player__meta` in `css/styles.css`, and on `swipeDown` in
`js/app.js`. The playing cover lights up on hover; nothing moves or lifts. Space plays and
pauses. `prev` rewinds to the start of the current track first and only steps back if you use
it again within the first few seconds.

## Notes

* **Fonts** — `fonts/` holds the *personal use* release of Monument Extended that came with
  the project. If this goes live commercially, buy the commercial licence and replace the two
  `.otf` files; the filenames in `css/styles.css` stay the same.
* **Tuning** — the look lives in the `:root` block of `css/styles.css`: `--panel` (block size),
  `--radius`, `--slow` (how long a panel takes to slide) and `--ease-slide` (its curve),
  `--tint` / `--ease-tint` (the lamp's colour cross-fade), `--ring-size` (how big the light
  is — bigger than the window on purpose, so it runs off the bottom).
* How far off screen a resting side panel sits is `PEEK` at the top of the `Carousel` module
  in `js/app.js`. It is negative: positive values would bring a panel back into frame. With a
  single panel it has nothing to do, but the whole carousel is still wired up and working.
* **The background** is a lamp behind a grille, in `css/styles.css`, bottom layer first:
  1. `.ring--glow` / `.ring--bloom` — the wash either side of the light. Both use
     `--ring-deep`: the artwork's hue taken right down in lightness, which is what a lamp
     actually throws onto the surface around it.
  2. `.leds` — the lamp itself. `.leds` masks it to the band, `.leds__noise` wanders its
     brightness with an SVG turbulence mask so it never looks generated, `.leds__dots` puts
     one lit point in every cell of the honeycomb, and `.leds__accents` paints over the top,
     replacing roughly one cell in three with a contrasting hue.
  3. `.env__mesh` — the perforated black grille, on top, cut from the same honeycomb at the
     same pitch, so each hole frames exactly one point.
  4. `.ring--core` — a thin pure-hue bloom sitting on the band. Kept at low opacity on
     purpose: the lit line is the dots, and nothing here carries a white plateau, because a
     white core is what stops coloured light reading as coloured light.
  The two masks have to live on separate nested elements — one element can't carry both the
  band shape and the noise.
* **The band** is 86.5%→90.5% of each ring's radius, feathered from 83.5% out to 94%. Those
  four numbers are repeated across `.ring--core`, `.leds` and the two wash layers — change
  one and change all four, or the dots and their glow come apart.
* **The lattice.** The grille tiles at `11px × 6.3504px` with a hex centred at
  `(3.667, 3.1752)` and another at `(9.167, 0)`. Together those give rows 3.1752 apart, every
  other row shifted half a column across. Every `background-position` in `.leds__dots` and
  `.leds__accents` is a point on that lattice. The accents take every other cell, stepping
  half a column right on each row down, so half the cells are accented in an alternating
  field rather than in stripes — and they stay put, because a cell that keeps its colour is
  what makes the pattern read at all. Making the grille finer or coarser means redoing all
  of it.
* **The colours** come from the artwork (`js/app.js`). `Colour.vivid` is the band,
  `Colour.deep` the wash, and `Colour.accent` the two particle hues — which way they step
  round the wheel depends on where the lamp sits (`Colour.accentTurns`): a blue lamp gets
  cyan and mint-green, a purple one magenta and pink-violet, always towards the more luminous
  side of its own hue. The steps are small on purpose: far-apart hues stop the eye averaging
  the field back to the artwork's colour. Both accents are stepped off the *lamp* rather than
  the raw artwork — off the artwork they inherit its saturation, and on a muted cover that
  leaves the particles duller than the band they sit in.
* **A track with no artwork** (`demo: true`, or `artwork: null`) has no colour to borrow, so
  it gets `DEMO_LIGHT` in `js/app.js` instead: a bright white house lamp with yellow
  alternating through it cell by cell. Both accents are yellow — one saturated, one pale — so
  the checkerboard reads white against yellow rather than white against white. The base is a
  hair off `#fff` on purpose: a pure white lamp reads as a blown highlight, not as light.
* **Flicker** is `flicker`, 7.2–12s per layer, each layer on its own duration so they never
  lock together, and only 7% deep at its lowest — a lamp that isn't quite steady rather than
  one that's failing. Opacity only, so it composites without repainting.
* **A track change** drives three things at once, all released together so the lamp settles
  as one: `--tint` (5s) is the colour cross-fade — the colours are registered with `@property`
  for exactly that, since a plain custom property only ever snaps — while `--flash` spikes
  brightness and `--charge` spikes saturation, both fast in and slow out over the same span.
  `--charge` is applied as a `filter` on `.leds` alone, not on the blurred wash layers, which
  would have to repaint their gradients for every frame of it.
* `js/app.js` exposes `Player.pause()` and `Carousel.onChange(fn)` if you later want to react
  to panel changes.
* The page is marked `noindex` — it is meant to be handed out as a link, not found.
