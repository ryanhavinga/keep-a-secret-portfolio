# The Player page (archived)

The original front page: one big cover with its neighbours tucked behind it, title and artist, a timeline,
volume and the transport buttons, over a light that takes its colour from the artwork. It is **switched off**:
the pill at the top no longer links to it and `player.html` / `js/app.js` live here instead.

This folder mirrors the site's layout, so putting it back is a copy (from the site's root):

```bash
cp archive/player/player.html player.html
cp archive/player/js/app.js js/app.js
```

Then add the link back to the pill — `<a class="seg__btn" href="player.html">Player</a>` between Portfolio and
Demos — in `index.html` and `demos.html`.

Its content is `tracks` in `js/config.js` (all of the portfolio's tracks), and all of its styling is still in
`css/styles.css` (the `.stage`, `.cover`, `.player`, `.ring` / `.leds` parts), so nothing else has to come back.
