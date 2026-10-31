# KEEP A SECRET — private listening room

A static site. No build step, no dependencies. Open `index.html` (the portfolio, the landing page) in a browser, or drop the
whole folder onto any host (Netlify, Vercel, Cloudflare Pages, plain FTP).

```
index.html          the landing page: the portfolio
demos.html          the demos (unreleased songs)
css/styles.css      all styling
js/config.js        ← everything you normally edit lives here
js/center.js        the landing page: the centre cover, the two stacks, the now-playing bar
js/nav.js           the Portfolio · Demos pill
archive/            switched-off things kept for later: the Player page, the earlier shelf page, the 3D-door vault, an older list page
img/                artwork
audio/              your audio files
fonts/              Monument Extended
```

## Run it locally

Open `index.html` directly, or — better — serve it:

```bash
python3 -m http.server 4321
```

Then visit `http://localhost:4321`.

> Opening the file straight off disk (`file://`) works fine, but browsers block reading
> image pixels from local files, so the panel falls back to the `color` value written in
> `js/config.js` for each track. Those fallbacks are already set to match your covers.

> **The Player page is switched off.** `player.html` and `js/app.js` (the carousel, its light and everything the
> sections "Tracks", "Footer credit", "Panel order", "Navigating" and "Notes" below say about *the player*) are
> kept in `archive/player/` — see the README there for how to put them back. Their styling is still in
> `css/styles.css`. The 3D safe-door version of the demos page is kept there too (`archive/vault-door/`).

## Editing

Everything below is in **`js/config.js`**.

### Logo
```js
brand: { logo: 'Keep A Secret', logoImage: null, tagline: 'Private Session' }
```
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

### Demos (`demos.html`)
A plain page for unreleased songs that are still available for an artist to cut, kept apart from the portfolio
(released records). Reached with "Demos" on the pill at the top of every page (see below). No title of its own; the songs are listed under a heading per language (Nederlandstalig, Engelstalig),
each a list: a number, the title with a small line of genre · BPM · key (and a note, if
there is one), the same play button and timeline as the player, and a "Request" link that opens an email to
`contact` with the subject "Demo request: <title>" and a line asking for that demo. Playing one stops the last; when
one ends the next starts.

Its content is `demos` in `js/config.js`: `contact` (where "Request" mails to) and `tracks` — one
entry per song (`title`, `language` (the heading it sits under), `audio`, `duration`, optional `genre`/`bpm`/`key`/`note`, and `status`: `'available'`,
`'on hold'` or `'cut'`; the last two replace the Request link with their label). A song with `audio: null` shows
"Audio to follow". The page is `demos.html`, `css/demos.css` and `js/demos.js`.

This page used to be called **The Vault**, with a 3D safe door that opened onto a wall of deposit boxes; that
version is saved in `archive/vault-door/` (README there). It still uses the old names (`vault.html`, `CONFIG.vault`).

### The page pill
Every page (Portfolio, Demos) has the same pill at the top: `Portfolio · Demos`. The dark slider sits under the page
you are on; choosing another page glides it across, then the page fades over. It is markup in each HTML page
(`<nav class="seg" data-seg>`) driven by `js/nav.js`, styled in `css/styles.css`.

**There are no passwords on the site any more** — the front door (SEP26 / OKT26), the publishers' page (HAP) and the
Demos password are all gone, and every page is open to anyone with the link. The pages say `noindex`, so they are not
found by search, but they are not protected. If something ever needs protecting, put the site behind your host's own
password (Netlify and Cloudflare both do this server-side).

### Portfolio (`index.html`, the landing page)
Seven covers in a 3D room: **one always stands flat in the middle**, facing you, with the player bar under it; **three stand
on each side**, edge-on to the middle and close together, the outermost ones running off the sides of the page, softly blurred.
Everything is in view at once, no scrolling. The size comes from the window (`--w` in `css/portfolio.css`); the picture itself —
how big the middle cover is, how close and how far back the stacks stand — is a handful of numbers at the top of `js/center.js`
(`MID`, `BIG`, `SPACING`, `FACE`, `EDGE`, `BACK`, `MIDLINE`, `STACKLINE`, `GLOW`, `WAVE`, `REACH`).

- **Switching.** Click a cover in a stack, press ← / →, scroll, or use the bar's previous / next: that cover comes to the middle.
  The cover that was in the middle goes back to its side while the new one comes forward — the two move as a pair, with the same
  time and curve, so they pass each other without touching (`.is-back` / `.is-front` in `index.html`). Nothing can be chosen
  while the row is still turning. The bar's track, title and artwork change at once.
- **The player bar** is under the middle cover and plays its track; the speaker slides left across the bar to a volume line.
- **Hover.** Only the cover under the pointer lifts; the middle cover never moves. Each stack follows the pointer with its own
  viewpoint, and only while the pointer is on that side.
- **The light.** The middle cover throws its colour on the floor under the bar; the other covers keep their own pool.
- **The page pill** at the top is only there while the pointer is above or below the covers.
- **Layers.** Covers are deliberately *not* in one shared 3D space: each stack is its own perspective box (`.stack`), so two covers can
  never intersect or flicker against each other. Don't put `transform-style: preserve-3d` on `.shelf`.
- The covers are `CONFIG.portfolio.tracks`, run round again until there are seven. The earlier shelf page (every cover edge-on,
  one pulled out to play, with the credits view) is kept in `archive/shelf/`.

The player on the front page is for what we *feature*; this page is the whole catalogue. It's
`CONFIG.portfolio` in `js/config.js` — one line per track: `title`, `artist`, `artwork`, a fallback `color`,
optional `audio`, `year`, `note`, `links`. The tint of each sleeve edge is sampled from its artwork. Reached with
"Portfolio" on the page pill; open to everyone.

**Artwork wants to be big:** the cover is shown up to ≈700 px wide and the screens it's seen on are mostly
2×, so aim for **1400–2000 px square** JPEGs (under ≈500 KB each). Replace a file in `img/` under the same name
and the page picks it up. Apple Music is a good source: take the cover's image URL and swap the size at the
end (`…/600x600bb.jpg`) for `3000x3000bb.jpg`. (Spotify tops out at 640 px.) The link-preview image for the
front page (`img/og-preview.jpg`, ≈300 KB) is kept separate and light on purpose, because some apps drop
previews over ≈300 KB.

### Footer credit
"© Keep A Secret. All Rights Reserved" and "Written & produced by Keep A Secret" sit fixed,
centred at the very bottom of the page — set directly in `player.html` (`.footer-credit`), not
in `js/config.js`. Site-wide rather than per-track, so there's nothing to edit per song; change
the text in the markup itself if it ever needs to say something else.

### TikTok and Bio — removed from the page
Both panels were taken out of `player.html`. Their settings are still in `js/config.js`
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
